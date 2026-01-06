package org.yuwakisa.flow.colorwheel

import org.yuwakisa.flow.colorwheel.ColorWheel.Rgb
import org.yuwakisa.flow.Stuff._

object Luminance:

  val max = (1.0, 1.0, 1.0)

  def w3c(rgb: Rgb): Double = rgb._1 * .299 + rgb._2 * .587 + rgb._3 * .117

  val maxW3c = w3c(max)

  def srgb(rgb: Rgb): Double = rgb._1 * .2126 + rgb._2 * .7152 + rgb._3 * .0722

  val maxSrgb = srgb(max)

  def euclidian(rgb: Rgb): Double = math.sqrt(rgb._1 * rgb._1 * .299 +
    rgb._2 * rgb._2 * .587 +
    rgb._3 * rgb._3 * .114)

  val maxEuclidian = srgb(max)

  def lumsort(s: IndexedSeq[Rgb]): IndexedSeq[Rgb] =
    s.sortWith((a, b) =>
      Luminance.srgb(a) < Luminance.srgb(b))

  def linear(min: Double, max: Double)(palette: IndexedSeq[Rgb]) =
    palette.zipWithIndex.map :
      (c, i) =>
        val v = i / (palette.length - 1d) * (max - min) + min
        val (h0, s0, l0) = ColorWheel.rgbToHsl(c._1, c._2, c._3)
        ColorWheel.hslToRgb(h0, s0, v)
//    .chain(lumsort)

  def relativeLinear(min: Double, max: Double)(palette: IndexedSeq[Rgb]) =
    palette.zipWithIndex.map :
      (c, i) =>
        val v = i / (palette.length - 1d) * (max - min) + min
        val relativeC = srgb(c._1, c._2, c._3)

        val (h0, s0, l0) = ColorWheel.rgbToHsl(c._1, c._2, c._3)
        val rgb0 = ColorWheel.hslToRgb(h0, s0, 0.5)
        val relative0 = srgb(rgb0._1, rgb0._2, rgb0._3)

        val rgb1 = ColorWheel.hslToRgb(h0, s0, v * 0.5 / relative0)
        val relative1 = srgb(rgb1._1, rgb1._2, rgb1._3)

        println((v, relativeC, relative0, relative1))

        rgb0
  //    .chain(lumsort)

  def sqrt(palette: IndexedSeq[Rgb]) =
    palette.zipWithIndex.map :
      (c, i) =>
        val v = srgb(c)
        val (h, s, l) = (ColorWheel.rgbToHsl _).tupled(c)
        ColorWheel.hslToRgb(h, s, v)
