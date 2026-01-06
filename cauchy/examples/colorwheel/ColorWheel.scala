package org.yuwakisa.flow.colorwheel

import org.yuwakisa.flow.Stuff.sqr

object ColorWheel:

  case class Radial(a: Double, r: Double)

  type Rgb = (Double, Double, Double)

  def mod1(a: Double): Double =
    if a < 0.0 then a + 1.0
    else if a > 1.0 then a - 1.0
    else a

  // see https://www.dcode.fr/function-equation-finder
  // https://www.wolframalpha.com/input/

  def curve1(x: Double): Double = 1.0 / (1.0 + math.pow(x / (1 - x), -1))

  def curve3(x: Double): Double = (1.333 * x * x * x - 2 * x * x + x) * 3

  def curve5(x: Double): Double =
    2.083 * x * x * x +
      -3.125 * x * x +
      2.041 * x

  def curve6(x: Double): Double =
    4.167 * x * x * x +
      -6.25 * x * x +
      3.083 * x

  // also see HSLuv for relative lightness
  // https://www.hsluv.org/

  def hslToRgb(h: Double, s: Double, l: Double): Rgb =
    val chroma = (1 - math.abs(2 * l - 1)) * s
    val hp = h * 6
    val x = chroma * (1 - math.abs((hp % 2) - 1))

    val (r1, g1, b1) =
      math.floor(hp) match
        case 0 => (chroma, x, 0d)
        case 1 => (x, chroma, 0d)
        case 2 => (0d, chroma, x)
        case 3 => (0d, x, chroma)
        case 4 => (x, 0d, chroma)
        case 5 => (chroma, 0d, x)
        case _ => (chroma, 0d, x)
    val m = l - chroma / 2
    (r1 + m, g1 + m, b1 + m)

  def rgbToHsl(r: Double, g: Double, b: Double): (Double, Double, Double) =
    val cmax = math.max(r, math.max(g, b))
    val cmin = math.min(r, math.min(g, b))
    val d = cmax - cmin

    val l = (cmax + cmin) / 2

    val s =
      if d == 0 then
        0
      else
        d / (1 - math.abs(2 * l - 1))

    val h =
      if d == 0 then
        0
      else if cmax == r then
        (g - b) / d
      else if cmax == g then
        (b - r) / d + 2
      else
        (r - g) / d + 4

    (mod1(h / 6), s, l)
  
  def pixToRGBLuminosity(rd: Radial): Rgb = hslToRgb(rd.a, 1, sqr(1 - rd.r))

  def pixToRGBSaturation(rd: Radial): Rgb = hslToRgb(rd.a, rd.r, .5)
