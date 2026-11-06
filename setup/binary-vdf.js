const { TextDecoder } = require('util');
const utf8 = new TextDecoder('utf-8', { fatal: true });
// Steam shortcuts use Valve binary KeyValues. Preserve untouched values byte for
// byte; unsupported/truncated input is rejected rather than guessed/repaired.
function parse(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > 16 * 1024 * 1024) throw new Error('Unsupported shortcut database size');
  let pos = 0, fields = 0;
  function need(n) { if (pos + n > buffer.length) throw new Error('Truncated shortcut database'); }
  function string() {
    const end = buffer.indexOf(0, pos);
    if (end < 0) throw new Error('Unterminated shortcut string');
    const value = utf8.decode(buffer.subarray(pos, end)); pos = end + 1; return value;
  }
  function object(depth) {
    if (depth > 16) throw new Error('Shortcut nesting limit exceeded');
    const nodes = [];
    while (pos < buffer.length) {
      need(1); const start = pos, type = buffer[pos++];
      if (type === 8) return nodes;
      if (++fields > 100000) throw new Error('Shortcut field limit exceeded');
      const name = string(); let value;
      if (type === 0) value = object(depth + 1);
      else if (type === 1) value = string();
      else if ([2, 3, 4, 6, 7, 10].includes(type)) {
        const size = type === 7 || type === 10 ? 8 : 4; need(size);
        value = type === 2 ? buffer.readUInt32LE(pos) : Buffer.from(buffer.subarray(pos, pos + size)); pos += size;
      } else throw new Error('Unsupported shortcut value type');
      nodes.push({ type, name, value, raw: Buffer.from(buffer.subarray(start, pos)) });
    }
    throw new Error('Unterminated shortcut object');
  }
  const nodes = object(0);
  if (pos !== buffer.length) throw new Error('Trailing shortcut data');
  return nodes;
}
const cstring = value => {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('Invalid shortcut string');
  return Buffer.from(value + '\0', 'utf8');
};
function encode(nodes) {
  const chunks = nodes.map(node => {
    if (node.raw) return node.raw;
    const head = Buffer.concat([Buffer.from([node.type]), cstring(node.name)]);
    let value;
    if (node.type === 0) value = encode(node.value);
    else if (node.type === 1) value = cstring(node.value);
    else if (node.type === 2) { value = Buffer.alloc(4); value.writeUInt32LE(node.value >>> 0); }
    else if (Buffer.isBuffer(node.value)) value = node.value;
    else throw new Error('Unsupported shortcut encoding');
    return Buffer.concat([head, value]);
  });
  return Buffer.concat([...chunks, Buffer.from([8])]);
}
function field(nodes, name) { return nodes.find(node => node.name.toLowerCase() === name.toLowerCase()); }
function set(nodes, name, value, type = 1) {
  const found = field(nodes, name);
  if (found && found.type !== type) throw new Error('Unexpected shortcut field type');
  if (found) { found.value = value; delete found.raw; }
  else nodes.push({ name, type, value });
}
function crc32(text) {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
module.exports = { parse, encode, field, set, crc32 };
