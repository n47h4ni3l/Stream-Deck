const { getSortedServices, services } = require('../main');

describe('getSortedServices', () => {
  test('sorts services based on provided usage data', () => {
    const usage = { Netflix: 3, Hulu: 1, Prime: 2 };
    const sorted = getSortedServices(usage);
    expect(sorted[0]).toBe('Netflix');
    expect(sorted[1]).toBe('Prime');
    expect(sorted[2]).toBe('Hulu');
  });

  test('returns all available services', () => {
    const sorted = getSortedServices({});
    expect(sorted.length).toBe(Object.keys(services).length);
  });

  test.each([null, [], true, 7, 'history'])('treats an invalid root %p as empty history', data => {
    expect(getSortedServices(data)).toEqual(Object.keys(services));
  });

  test('ignores invalid counts without mutating valid input', () => {
    const data = { Hulu: 4, Max: 2, Netflix: '99', Prime: -3, YouTube: 0.5, Stan: Infinity };
    expect(getSortedServices(data).slice(0, 2)).toEqual(['Hulu', 'Max']);
    expect(data.Netflix).toBe('99');
  });
});
