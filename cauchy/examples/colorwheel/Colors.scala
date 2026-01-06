package org.yuwakisa.flow.colorwheel

import com.badlogic.gdx.graphics.Color
import org.yuwakisa.flow.Stuff._
import org.yuwakisa.flow.colorwheel.ColorWheel.Rgb
import org.yuwakisa.flow.colorwheel.Colors.gradient
import org.yuwakisa.flow.colorwheel.Luminance.lumsort

import scala.util.Random

/**
 * Companion object has color functions
 */
object Colors:

  type RgbMap = Double => Rgb

  type ColorMap = Double => Color

  /**
   * @param colors
   * @return function that maps from 0..1 to a solid color
   */
  def bands(colors: IndexedSeq[Rgb]): ColorMap = 
    { (v: Double) =>
      val i = math.min(colors.length - 1, (v * colors.length).toInt)
      colors(i)
    }
      .chain(toColors)

  /**
   * @param colors
   * @return function that maps from 0..1 to an interpolated color
   */
  def gradient(colors: IndexedSeq[Rgb]): ColorMap =
    { (v: Double) =>
      val lo = math.floor(v * colors.length)
      val hi = math.floor(v * colors.length) + 1
      val mid = (v * colors.length - lo) / (hi - lo)
      val (lor, log, lob) = colors(math.min(colors.length - 1, lo.toInt))
      val (hir, hig, hib) = colors(math.min(colors.length - 1, hi.toInt))
      val r = lor * (1d - mid) + hir * mid
      val g = log * (1d - mid) + hig * mid
      val b = lob * (1d - mid) + hib * mid
      (r, g, b)
    }
      .chain(toColors)

  def toColors(f: Double => Rgb): ColorMap =
    { v =>
      val (r, g, b) = f(v)
      Color(r.toFloat, g.toFloat, b.toFloat, 1f)
    }

  def graypix(v: Double): Color = new Color(v.toFloat, v.toFloat, v.toFloat, 1f)

  def rainbow(v: Double): Color =
    val (r, g, b): Rgb = math.min(0, (1 - v) * 5).toInt
    match
      case 0 => (1, 1 - v, 0)
      case 1 => (v, 1, 0)
      case 2 => (0, 1, 1 - v)
      case 3 => (0, v, 1)
      case 4 => (1 - v, 0, 1)
      case _ => (1, 0, 1)

    new Color(r.toFloat, g.toFloat, b.toFloat, 1f)

/**
 * Precalcuate colors
 *
 * @param n number of buckets
 * @param f function to generate color for a value
 */
case class Colors(n: Int, palette: IndexedSeq[Rgb]):
  val f = gradient(palette)
  val cache: IndexedSeq[Color] = (0 to n).map({ i => f(i.toDouble / n) })

  def apply(v: Double): Color =
    cache(math.max(0, math.min(cache.length - 1, v * n)).toInt)
