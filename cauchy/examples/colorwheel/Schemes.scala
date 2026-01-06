package org.yuwakisa.flow.colorwheel

import org.yuwakisa.flow.Stuff._
import org.yuwakisa.flow.colorwheel.ColorWheel.{Radial, Rgb, mod1}
import org.yuwakisa.flow.colorwheel.Luminance.lumsort

import scala.util.Random

object Schemes:
  def OneSpoke: Double = 1d / 12d

  def randomR: Double = 0.8 - Random.nextDouble * 0.8

  def monochromatic(rr: Radial): IndexedSeq[Rgb] =
    Seq.fill(5)(randomR)
      .sorted
      .toIndexedSeq
      .map(Radial(rr.a, _))
      .map(ColorWheel.pixToRGBLuminosity)

  def analogous(rr: Radial): IndexedSeq[Rgb] =
    IndexedSeq(
      Radial(rr.a, rr.r),
      Radial(rr.a, randomR),
      Radial(mod1(rr.a + OneSpoke), rr.r),
      Radial(mod1(rr.a + OneSpoke), randomR),
      Radial(mod1(rr.a - OneSpoke), rr.r))
      .map(ColorWheel.pixToRGBLuminosity)

  def triad(rr: Radial): IndexedSeq[Rgb] =
    IndexedSeq(
      Radial(rr.a, rr.r),
      Radial(rr.a, randomR),
      Radial(mod1(rr.a + 4 * OneSpoke), rr.r),
      Radial(mod1(rr.a + 4 * OneSpoke), randomR),
      Radial(mod1(rr.a - 4 * OneSpoke), rr.r))
      .map(ColorWheel.pixToRGBLuminosity)

  def complementary(rr: Radial): IndexedSeq[Rgb] =
    IndexedSeq(
      Radial(rr.a, rr.r),
      Radial(rr.a, mod1(rr.r - 0.1d)),
      Radial(rr.a, mod1(rr.r + 0.1d)),
      Radial(mod1(rr.a + 6 * OneSpoke), rr.r),
      Radial(mod1(rr.a + 6 * OneSpoke), randomR))
      .map(ColorWheel.pixToRGBLuminosity)

  def splitComplementary(rr: Radial): IndexedSeq[Rgb] =
    IndexedSeq(
      Radial(rr.a, rr.r),
      Radial(mod1(rr.a + 5 * OneSpoke), rr.r),
      Radial(mod1(rr.a + 5 * OneSpoke), randomR),
      Radial(mod1(rr.a - 5 * OneSpoke), rr.r),
      Radial(mod1(rr.a - 5 * OneSpoke), randomR))
      .map(ColorWheel.pixToRGBLuminosity)

  def doubleSplitComplementary(rr: Radial): IndexedSeq[Rgb] =
    IndexedSeq(
      Radial(rr.a, rr.r),
      Radial(mod1(rr.a + 1 * OneSpoke), rr.r),
      Radial(mod1(rr.a - 1 * OneSpoke), rr.r),
      Radial(mod1(rr.a + 5 * OneSpoke), rr.r),
      Radial(mod1(rr.a - 5 * OneSpoke), rr.r))
      .map(ColorWheel.pixToRGBLuminosity)

  def square(rr: Radial): IndexedSeq[Rgb] =
    IndexedSeq(
      Radial(rr.a, rr.r),
      Radial(rr.a, randomR),
      Radial(mod1(rr.a + 4 * OneSpoke), rr.r),
      Radial(mod1(rr.a - 4 * OneSpoke), rr.r),
      Radial(mod1(rr.a + 6 * OneSpoke), rr.r))
      .map(ColorWheel.pixToRGBLuminosity)

  def compound(rr: Radial): IndexedSeq[Rgb] =
    IndexedSeq(
      Radial(rr.a, rr.r),
      Radial(mod1(rr.a - 1 * OneSpoke), rr.r),
      Radial(mod1(rr.a - 1 * OneSpoke), randomR),
      Radial(mod1(rr.a - 5 * OneSpoke), rr.r),
      Radial(mod1(rr.a - 5 * OneSpoke), randomR))
      .map(ColorWheel.pixToRGBLuminosity)

  val All = Seq(monochromatic(_),
    analogous(_),
    triad(_),
    complementary(_),
    splitComplementary(_),
    doubleSplitComplementary(_),
    square(_),
    compound(_))

  def random(): IndexedSeq[Rgb] =
    val i = Random.nextInt(All.length)
    All(i)(Radial(Random.nextDouble, Schemes.randomR))
//      .chain(lumsort)
