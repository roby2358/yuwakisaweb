// osnemes.js — fun OS-themed file name generator.
//
// "Osnemes" are phoneme-like syllables that sound vaguely systemy. Three
// tables (HEADS, MIDS, TAILS) hold the pieces; a small PATTERNS list acts as
// a weighted graph that picks which positions to chain. The generator pulls
// one osneme per position, tacks on a legacy-Windows extension, and returns
// the result.
//
// Examples it can produce: krnswapctl.sys, syscachemgr.exe, ntfslog.dat,
// halexec.dll, biosqueueutil.cfg, dmadrv.sys.

export class Osnemes {
  // Kernel / subsystem flavored starts.
  static HEADS = [
    'sys', 'krn', 'win', 'hal', 'ntfs', 'gdi', 'ole',
    'dma', 'irq', 'bios', 'smb', 'tcp', 'usb', 'acpi',
  ];

  // Action / verb-y middles.
  static MIDS = [
    'log', 'mon', 'pipe', 'hook', 'dump', 'frag',
    'swap', 'cache', 'lock', 'queue', 'page', 'link',
  ];

  // Role / object endings.
  static TAILS = [
    'drv', 'mgr', 'ctl', 'exec', 'svc', 'init',
    'hlp', 'agt', 'host', 'base', 'util', 'daemon',
  ];

  // Extensions for that legacy-Windows feel.
  static EXTS = ['.exe', '.dll', '.sys', '.cfg', '.ini', '.dat', '.bat', '.drv'];

  // Position graph: each entry is a list of table indices (0=HEADS, 1=MIDS,
  // 2=TAILS). Triples are repeated to weight them more heavily than the
  // shorter shapes.
  static PATTERNS = [
    [0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2],
    [0, 1],
    [0, 2],
    [1, 2],
  ];

  static generate(randomFn) {
    const pick = (arr) => arr[Math.floor(randomFn() * arr.length)];
    const tables = [Osnemes.HEADS, Osnemes.MIDS, Osnemes.TAILS];
    const pattern = pick(Osnemes.PATTERNS);
    const parts = pattern.map((i) => pick(tables[i]));
    return parts.join('') + pick(Osnemes.EXTS);
  }
}
