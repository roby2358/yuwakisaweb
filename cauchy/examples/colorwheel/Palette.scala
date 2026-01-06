package org.yuwakisa.flow.colorwheel

import org.yuwakisa.flow.colorwheel.ColorWheel.Rgb

object Palette :
  
  type Palette = IndexedSeq[Rgb]

  def ofN(n: Double, colors: Rgb*): IndexedSeq[Rgb] =
    colors.toIndexedSeq.map({ case (r, g, b) => (r / n, g / n, b / n) })

  lazy val htmlRegex = raw"#?([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})".r

  def ofHex(hex: String): Double = Integer.parseInt(hex, 16) / 256d

  def ofHtml(html: String*): IndexedSeq[Rgb] =
    html.toIndexedSeq.map:
      h =>
        h.toUpperCase match {
          case htmlRegex(r, g, b) => (ofHex(r), ofHex(g), ofHex(b))
          case _ => (0d, 0d, 0d)
          }

  def random() = Schemes.random()

  val Grayscale: IndexedSeq[Rgb] = IndexedSeq((0, 0, 0), (1, 1, 1))

  val Fire: IndexedSeq[Rgb] = IndexedSeq(
    (1, 0, 0),
    (1, 0, 0),
    (1, .5f, 0),
    (1, 1, 0),
    (1, 1, 1))

  val BlueFire: IndexedSeq[Rgb] = IndexedSeq(
    (0, 0, 1),
    (0, .5, 1),
    (0, 1, 1),
    (1, 1, 1))

  val Ocean = ofN(100f,
    (0, 43, 50),
    (0, 43, 50),
    (0, 64, 68),
    (58, 87, 87),
    (67, 90, 90))

  val Seaweed = ofN(100f,
    (0, 43, 50),
    (14, 23, 8),
    (38, 52, 18),
    (38, 52, 18),
    (52, 67, 30))

  // #e5d9c2
  val Terrain = ofHtml("#b6e3db", "#7c8d4c", "#b5ba61", "#725428")

  val Coh = ofHtml("#363C59", "#377BA6", "#38E0F2", "#35F2DF", "#42592A")

  //      "#272526",
  //      "#F2D8CE",
  //      "#FDE0D2"
  val Skin0 = ofHtml(
    "#A5704F",
    "#BF7D65",
    "#D99E79",
    "#F2C3A7"
  )

  val Rainbow = IndexedSeq(
    (.4d, 0d, .5d),
    (.2d, 0d, .8d),
    (0d, 0d, 1d),
    (0d, .6d, 1d),
    (0d, 1d, 1d),
    (0d, .8d, .6d),
    (0d, .8d, 0d),
    (.6d, .8d, 0d),
    (1d, 1d, 0d),
    (1d, .6d, 0d),
    (1d, 0d, 0d))

  val CandyLand = IndexedSeq(
    (0d, 0d, 0d),
    (.4d, 0d, .5d),
    (0d, 0d, 1d),
    (0d, .8d, 0d),
    (1d, 1d, 0d),
    (1d, .6d, 0d),
    (1d, 0d, 0d))

  val Terrain50 = IndexedSeq(
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db

    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c

    (.7d, .73d, .38d), // b5ba61
    (.7d, .73d, .38d), // b5ba61
    (.7d, .73d, .38d), // b5ba61

    (.45d, .33d, .16d), // 725428
  )

  val Terrain33 = IndexedSeq(
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db

    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c

    (.7d, .73d, .38d), // b5ba61
    (.7d, .73d, .38d), // b5ba61
    (.7d, .73d, .38d), // b5ba61

    (.45d, .33d, .16d), // 725428
  )

  val Terrain66 = IndexedSeq(
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db
    (.7d, .9d, .86d), // b6e3db

    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c
    (.5d, .55d, .3d), // 7c8d4c

    (.7d, .73d, .38d), // b5ba61
    (.7d, .73d, .38d), // b5ba61
    (.7d, .73d, .38d), // b5ba61

    (.45d, .33d, .16d), // 725428
  )
