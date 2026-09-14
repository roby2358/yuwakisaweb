// Cars: arc-length position s (m), speed v (m/s), lateral offset lat (m, + = left).
// Each car chases its cruise speed but brakes for corners it sees ahead and speeds up for the
// jump. A slowly drifting judgment factor makes it misjudge; exceeding the corner limit triggers
// a slide, and leaving the lip too slow drops the car into the gap for a hard landing.
var Cars = {
  scale: 2.8,        // toy-car proportion so cars read at track scale
  length: 4.4 * 2.8,
  width: 2.2 * 2.8,
  accel: 72,          // m/s^2 toward target speed
  brake: 50,         // m/s^2 when slowing for a corner
  grip: 871,          // corner limit: vmax = sqrt(grip / curvature)
  lookahead: 140,     // m scanned ahead for the tightest upcoming corner
  lookStep: 10,
  slideDecel: 60,    // m/s^2 scrubbed while over the limit
  slideShove: 30,    // outward lateral m/s per second of sliding
  judgeSpread: 0.10, // judgment drifts within roughly +/- this fraction of true limit
  judgeRate: 0.4,    // how quickly judgment wanders (per second)
  bumpLoss: 0.5,     // rear car keeps this fraction of the front car's speed after a bump
  bumpShare: 0.2,    // front car takes this share of the speed difference on a bump
  wallBounce: 0.3,   // fraction of lateral speed kept after hitting the track edge
  shove: 6,          // lateral m/s imparted by a bump
  latSpring: 3,      // pull back toward the lane center
  latDamp: 2.5,
  jumpGravity: 100,  // m/s^2; toy-scale gravity keeps a hop near the landing
  jumpMargin: 1.15,  // cars aim this far above the speed that just clears the gap
  shortLoss: 0.4,    // speed kept after landing in the gap
  landLoss: 0.92,    // speed kept after a clean landing

  make: function (s, cruise, lane, paint) {
    return { s: s, v: cruise, cruise: cruise, lane: lane, lat: lane, latV: 0, judge: 1, sliding: false, flight: null, paint: paint };
  },

  // The two-car starting field.
  field: function () {
    return [
      Cars.make(0, 230, Track.laneOffset, { body: '#e53935', roof: '#1a1a1a' }),
      Cars.make(-20, 252, -Track.laneOffset, { body: '#1e88e5', roof: '#1a1a1a' })
    ];
  },

  limit: function (k) {
    var mag = Math.abs(k);
    return mag < 1e-4 ? Infinity : Math.sqrt(Cars.grip / mag);
  },

  // Slowest corner limit within lookahead distance, as the car perceives it.
  perceivedLimit: function (car, track) {
    var v = Cars.limit(Track.laneCurvature(track, car.s, car.lat));
    for (var d = Cars.lookStep; d <= Cars.lookahead; d += Cars.lookStep) {
      v = Math.min(v, Cars.limit(Track.laneCurvature(track, car.s + d, car.lat)));
    }
    return v * car.judge;
  },

  // Speed that just carries a car from the lip to the landing.
  clearSpeed: function (jump) {
    return Math.sqrt(Cars.jumpGravity * (jump.land - jump.take) / (2 * jump.slope));
  },

  // Speed the car drives toward: cruise, held down by corners ahead, held up by the jump ahead.
  target: function (car, track) {
    var target = Math.min(car.cruise, Cars.perceivedLimit(car, track));
    if (Track.ahead(track, car.s, track.jump.take) > Cars.lookahead) return target;
    return Math.max(target, Cars.clearSpeed(track.jump) * Cars.jumpMargin * car.judge);
  },

  // Ornstein-Uhlenbeck wander around 1.
  driftJudgment: function (car, dt) {
    var noise = (Math.random() * 2 - 1) * Math.sqrt(dt);
    car.judge += (1 - car.judge) * Cars.judgeRate * dt + noise * Cars.judgeSpread * Math.sqrt(2 * Cars.judgeRate);
  },

  // Airborne: height follows gravity while s coasts. Touching down short of the landing
  // means the car dropped into the gap; it is set on the landing at a fraction of its speed.
  fly: function (car, dt, track) {
    car.flight.vy -= Cars.jumpGravity * dt;
    car.flight.y += car.flight.vy * dt;
    car.s += car.v * dt;
    if (car.flight.y > 0) return;
    car.flight = null;
    if (!Track.inGap(track, car.s)) { car.v *= Cars.landLoss; return; }
    car.s = track.jump.land;
    car.v *= Cars.shortLoss;
  },

  step: function (car, dt, track) {
    Cars.driftJudgment(car, dt);
    if (car.flight) { Cars.fly(car, dt, track); return; }
    var k = Track.laneCurvature(track, car.s, car.lat);
    var target = Cars.target(car, track);
    var rate = target < car.v ? Cars.brake : Cars.accel;
    car.v += Math.max(-rate * dt, Math.min(rate * dt, target - car.v));

    car.sliding = car.v > Cars.limit(k);
    if (car.sliding) {
      car.v -= Cars.slideDecel * dt;
      car.latV -= Math.sign(k) * Cars.slideShove * dt;
    }

    car.s += car.v * dt;
    if (Track.inGap(track, car.s)) car.flight = { y: track.jump.height, vy: car.v * track.jump.slope };
    car.latV += ((car.lane - car.lat) * Cars.latSpring - car.latV * Cars.latDamp) * dt;
    car.lat += car.latV * dt;
    var lim = track.width / 2 - Cars.width / 2;
    if (Math.abs(car.lat) > lim) {
      car.lat = Math.sign(car.lat) * lim;
      car.latV = -car.latV * Cars.wallBounce;
    }
  },

  // Signed along-track gap from a to b, wrapped into [-total/2, total/2).
  gap: function (a, b, total) {
    var d = (b.s - a.s) % total;
    if (d < -total / 2) d += total;
    if (d >= total / 2) d -= total;
    return d;
  },

  bump: function (a, b, total) {
    var ds = Cars.gap(a, b, total), dl = b.lat - a.lat;
    if (Math.abs(ds) >= Cars.length || Math.abs(dl) >= Cars.width) return;
    var closing = (a.v - b.v) * Math.sign(ds);
    if (closing > 0) {
      // The rear car eats the hit: it drops well below the front car's speed and has to re-accelerate.
      var rear = ds > 0 ? a : b, front = ds > 0 ? b : a;
      front.v += (rear.v - front.v) * Cars.bumpShare;
      rear.v = front.v * Cars.bumpLoss;
    }
    var overlap = Cars.length - Math.abs(ds);
    a.s -= Math.sign(ds) * overlap / 2;
    b.s += Math.sign(ds) * overlap / 2;
    var dir = dl === 0 ? 1 : Math.sign(dl);
    a.latV -= dir * Cars.shove;
    b.latV += dir * Cars.shove;
  },

  // Where the car sits in the world: on the road, or in the air at its flight height and pitch.
  place: function (car, track) {
    var at = Track.at(track, car.s);
    if (!car.flight) return { pos: at.pos, dir: at.dir, side: at.side };
    var flat = Vec.norm(Vec.make(at.dir.x, 0, at.dir.z));
    return { pos: Vec.make(at.pos.x, car.flight.y, at.pos.z), dir: Vec.norm(Vec.make(flat.x, car.flight.vy / car.v, flat.z)), side: at.side };
  },

  polys: function (car, track) {
    var at = Cars.place(car, track);
    var pos = Vec.add(at.pos, Vec.scale(at.side, car.lat));
    return Cars.mesh(pos, at.dir, at.side, Cars.scale, car.paint);
  },

  lamps: function (car, track) {
    var at = Cars.place(car, track);
    return [-0.7, 0.7].map(function (off) {
      return { pos: Vec.add(Vec.add(at.pos, Vec.scale(at.side, car.lat + off * Cars.scale)),
        Vec.add(Vec.scale(at.dir, 2.05 * Cars.scale), Vec.make(0, 0.6 * Cars.scale, 0))),
        dir: at.dir, side: at.side };
    });
  },

  // Plain molded sports coupe: rounded shoulders, dark glazing and inset silver wheels.
  mesh: function (pos, dir, side, scale, paint) {
    function P(f, s, h) {
      // Compress the upper cabin while keeping tire clearance and ride height intact.
      if (h > .9) h = .9 + (h - .9) * .78;
      return Vec.add(Vec.add(Vec.add(pos, Vec.scale(dir, f * scale)), Vec.scale(side, s * scale)), Vec.make(0, h * scale, 0));
    }
    var polys = [], glass = '#101d23', tire = '#171b20';
    function face(pts, color) { polys.push({ pts: pts, color: color }); }
    function box() { polys.push.apply(polys, Mesh.box.apply(null, [P].concat([].slice.call(arguments)))); }
    // Several beveled cross sections give the nose and fenders a rounded silhouette.
    var sections = [[2.2,.80,.49],[2.02,.94,.62],[1.72,1.02,.77],[1.42,1.04,.85],
      [1.12,1.02,.83],[.88,.96,.78],[.45,.92,.76],[-.5,.93,.80],[-.88,1.02,.86],
      [-1.12,1.05,.90],[-1.42,1.05,.92],[-1.72,1.03,.88],[-2.02,.96,.79],[-2.2,.86,.66]];
    var rings = sections.map(function (s) {
      var f=s[0], w=s[1], h=s[2], bottom=.25;
      [1.42,-1.42].forEach(function (axle) {
        var d=Math.abs(f-axle);
        if(d<.51) bottom=Math.max(bottom,.43+Math.sqrt(.51*.51-d*d));
      });
      return [P(f,-w,bottom),P(f,-w,Math.max(bottom,h-.14)),P(f,-w*.78,h),
        P(f,w*.78,h),P(f,w,Math.max(bottom,h-.14)),P(f,w,bottom)];
    });
    for(var i=0;i<rings.length-1;i++) for(var j=0;j<5;j++) {
      face([rings[i][j],rings[i][j+1],rings[i+1][j+1],rings[i+1][j]],paint.body);
    }
    face(rings[0],paint.body); face(rings[rings.length-1],paint.body);
    var cabin=[{f:1.12,w:.74,h0:.83,h1:.85},{f:.60,w:.64,h0:.82,h1:1.19},
      {f:-.86,w:.63,h0:.82,h1:1.10},{f:-2.02,w:.72,h0:.79,h1:.81}];
    var cabinPolys = Mesh.loft(P,cabin,glass);
    // Solid fastback bodywork flows from the roof to the tail, without rear glazing.
    for (var panel = 6; panel < 9; panel++) cabinPolys[panel].color = paint.body;
    cabinPolys[cabinPolys.length - 1].color = paint.body;
    polys.push.apply(polys,cabinPolys);
    // Body-colored roof and slim pillars, leaving broad black window areas.
    face([P(.60,-.65,1.20),P(.60,.65,1.20),P(-.86,.64,1.11),P(-.86,-.64,1.11)],paint.body);
    // One center stripe follows the painted panels; the glass stays clear.
    function stripe(f0, h0, f1, h1) {
      face([P(f0,-.14,h0+.012),P(f0,.14,h0+.012),P(f1,.14,h1+.012),P(f1,-.14,h1+.012)],'#ffffff');
    }
    stripe(.60,1.20,-.86,1.11);
    stripe(-.86,1.11,-2.02,.82);
    stripe(-2.02,.82,-2.2,.66);
    for(var i=0;i<sections.length-1;i++) {
      var a=sections[i], b=sections[i+1];
      if(b[0]>=1.12) stripe(a[0],a[2],b[0],b[2]);
    }
    [-1,1].forEach(function (sideSign) {
      face([P(1.12,sideSign*.75,.86),P(1.01,sideSign*.75,.86),P(.51,sideSign*.65,1.20),P(.60,sideSign*.65,1.20)],paint.body);
      face([P(-.79,sideSign*.64,1.115),P(-.89,sideSign*.64,1.10),P(-.89,sideSign*.64,.83),P(-.79,sideSign*.64,.83)],paint.body);
      // Simple swept headlamps on the hood.
      face([P(2.02,sideSign*.64,.632),P(1.97,sideSign*.73,.657),P(1.69,sideSign*.79,.790),P(1.76,sideSign*.68,.762)],'#e8f0ed');
      polys[polys.length - 1].emissive = true;
      // Dark side skirts emphasize the tucked waist and wide rear haunches.
      face([P(.87,sideSign*.97,.27),P(.44,sideSign*.94,.21),P(-.86,sideSign*1.03,.23),P(-.64,sideSign*.97,.34)],tire);
      box(-2.21,-2.19,sideSign>0?.43:-.72,sideSign>0?.72:-.43,.46,.58,'#c92228');
      for (var lightFace = polys.length - 5; lightFace < polys.length; lightFace++) polys[lightFace].emissive = true;
    });
    box(2.19,2.205,-.47,.47,.29,.44,glass);
    // A thin splitter and rear diffuser give a planted stance without an oversized wing.
    box(2.06,2.23,-.83,.83,.20,.245,tire);
    box(-2.215,-2.10,-.67,.67,.20,.34,tire);
    // Twelve-sided tires and plain silver hubs keep the geometry inexpensive.
    [1.42,-1.42].forEach(function (f) {
      [-1,1].forEach(function (sign) {
        function W(angle,r,s) {return P(f+Math.cos(angle)*r,s,.43+Math.sin(angle)*r);}
        var rim=[];
        for(var k=0;k<12;k++) {
          var a=k*Math.PI/6,b=(k+1)*Math.PI/6;
          face([W(a,.43,sign*.87),W(b,.43,sign*.87),W(b,.43,sign*1.09),W(a,.43,sign*1.09)],tire);
          face([W(a,.43,sign*1.095),W(b,.43,sign*1.095),W(b,.29,sign*1.095),W(a,.29,sign*1.095)],tire);
          rim.push(W(a,.29,sign*1.10));
        }
        face(rim,'#82959f');
        // Five simple spokes read clearly even when the cars are small on screen.
        for(var spoke=0;spoke<5;spoke++) {
          var angle=spoke*Math.PI*2/5;
          face([W(angle-.20,.11,sign*1.112),W(angle-.10,.27,sign*1.112),
            W(angle+.10,.27,sign*1.112),W(angle+.20,.11,sign*1.112)],'#e0e7e9');
        }
        var hub=[];for(var k=0;k<8;k++) hub.push(W(k*Math.PI/4,.10,sign*1.105));
        face(hub,'#657782');
      });
    });
    polys.push({pts:[P(2.25,-1.1,0),P(2.25,1.1,0),P(-2.25,1.1,0),P(-2.25,-1.1,0)],color:'#34373c',ground:true,lift:.015});
    return polys;
  }
};
