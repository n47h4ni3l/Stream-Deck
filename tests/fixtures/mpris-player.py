import os
import signal
import sys
from pathlib import Path
from gi.repository import Gio, GLib

root = Path(sys.argv[1])
connection = Gio.bus_get_sync(Gio.BusType.SESSION, None)
xml = '''<node>
<interface name="org.mpris.MediaPlayer2"><property name="Identity" type="s" access="read"/></interface>
<interface name="org.mpris.MediaPlayer2.Player"><property name="PlaybackStatus" type="s" access="read"/></interface>
</node>'''

def get_property(_connection, _sender, _path, _interface, name):
    with (root / 'queries').open('a') as log:
        log.write(name + '\n')
    if name == 'Identity':
        return GLib.Variant('s', (root / 'identity').read_text())
    if name == 'PlaybackStatus':
        return GLib.Variant('s', (root / 'playback').read_text())
    return None

for info in Gio.DBusNodeInfo.new_for_xml(xml).interfaces:
    connection.register_object('/org/mpris/MediaPlayer2', info, None, get_property, None)
name = 'org.mpris.MediaPlayer2.chromium.instance' + str(os.getpid())
connection.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus',
                     'RequestName', GLib.Variant('(su)', (name, 0)), None, Gio.DBusCallFlags.NONE, 1000, None)
loop = GLib.MainLoop()
signal.signal(signal.SIGTERM, lambda *_: loop.quit())
(root / 'bus-ready').touch()
loop.run()
