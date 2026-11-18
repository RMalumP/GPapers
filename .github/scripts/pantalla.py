# Qué se ve en la pantalla del emulador (captura en bruto de «adb exec-out screencap»): el fondo de GPapers (#f7f8fa),
# blanco (la pantalla de carga de Chrome) u otra cosa (la pantalla de inicio del móvil, con su fondo de escritorio).
import sys
b = sys.stdin.buffer.read()
if len(b) < 16: print('sin captura'); sys.exit()
w, h = int.from_bytes(b[0:4], 'little'), int.from_bytes(b[4:8], 'little'); px = b[len(b) - w * h * 4:]
n = gp = bl = az = 0
for y in range(h // 8, h * 7 // 8, 9):   # sin las barras de arriba y abajo
    row = y * w * 4
    for x in range(0, w, 9):
        r, g, bb = px[row + x * 4], px[row + x * 4 + 1], px[row + x * 4 + 2]; n += 1
        if abs(r - 247) < 5 and abs(g - 248) < 5 and abs(bb - 250) < 5: gp += 1
        elif r > 250 and g > 250 and bb > 250: bl += 1
        elif abs(r - 0x24) < 30 and abs(g - 0x57) < 30 and abs(bb - 0xc5) < 30: az += 1
print(f'GPapers {gp * 100 // n}% · blanco {bl * 100 // n}% · azul {az * 100 // n}% · otro {(n - gp - bl - az) * 100 // n}%')
