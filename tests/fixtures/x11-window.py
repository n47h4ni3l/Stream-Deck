import ctypes
import os
import sys

# Only used by the disposable graphical fixture, never shipped or invoked by
# production. Set EWMH/class properties for a synthetic external browser window.
x = ctypes.CDLL('libX11.so.6')
x.XOpenDisplay.argtypes = [ctypes.c_char_p]
x.XOpenDisplay.restype = ctypes.c_void_p
display = x.XOpenDisplay(os.environ['DISPLAY'].encode())
if not display:
    raise SystemExit('No fixture display')
x.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
x.XDefaultRootWindow.restype = ctypes.c_ulong
x.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
x.XInternAtom.restype = ctypes.c_ulong
x.XChangeProperty.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong,
                             ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_int]
x.XSetClassHint.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_void_p]
x.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
x.XCloseDisplay.argtypes = [ctypes.c_void_p]

class Hint(ctypes.Structure):
    _fields_ = [('name', ctypes.c_char_p), ('klass', ctypes.c_char_p)]

window = int(sys.argv[1], 0)
label = sys.argv[2]
hint = Hint(label.lower().encode(), label.encode())
x.XSetClassHint(display, window, ctypes.byref(hint))
atom = lambda name: x.XInternAtom(display, name.encode(), 0)
active = ctypes.c_ulong(window)
x.XChangeProperty(display, x.XDefaultRootWindow(display), atom('_NET_ACTIVE_WINDOW'),
                  33, 32, 0, ctypes.byref(active), 1)
focused = ctypes.c_ulong(atom('_NET_WM_STATE_FOCUSED'))
x.XChangeProperty(display, window, atom('_NET_WM_STATE'), 4, 32, 0,
                  ctypes.byref(focused), 1 if sys.argv[3] == '1' else 0)
x.XSync(display, 0)
x.XCloseDisplay(display)
