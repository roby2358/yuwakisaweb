
// routines for monster gladiators guys

#include	"m_func.h"

#include	"name.h"



// global to hold point costs

stat_t	guy_cost = { '\x01','\x02','\x01','\x02','\x03' };



// sprint stats into a char buff
	char	*stat_t::stat_line( char *buff ) {

		sprintf( buff,"%2d/%2d/%2d %2d/%2d",
			skill,str,health,weapon,armor );

		return( buff );
  	};


// scale stats based on a number of points and a base
	int	scale128( int x, int n ) {
		return( ( (long)x * n + 64) >> 7 );
		};


	void	stat_t::scale( 	stat_t &base, int points ) {

		skill  = scale128( base.skill, points );
		str    = scale128( base.str, points );
		health = scale128( base.health, points );
		weapon = scale128( base.weapon, points );
		armor   = scale128( base.armor, points );

		if ( health <= 0 ) health = 1;

		}

// randomly adjust stats by a number of points
	int	stat_t::modify( Tscreen_t &screen, int pts ) {

		int	s,x,y,r;

		char	buff[80];

		x = 2;
		y = 4;
		sprintf( screen.buff,"%s %4d",stat_line(buff),pts );
		screen.out_buff(x,y++,15+BACKGR );
		screen(x,y,"\xCD\xCD\xCD",0+BACKGR );


		// get sign and absolute value of pts
		s = 1;
		if ( pts < 0 ) { s = -1; pts = -pts; }


		// add/subtract to use all points
		while ( pts > 0 ) {


			// determine which stat to use; wep & armor don't get -
			if ( pts > 1 )
				r = (s>0) ?R(1,5) :R(1,3);
			else
				r = R(1,2);

			switch ( r ) {

				case 1:
					if ( pts >= guy_cost.skill && ( s > 0 || skill ) ) {
						skill += s;
						pts -= guy_cost.skill;
						}
					break;

				case 2:
					if ( pts >= guy_cost.health && ( s > 0 || health ) ) {
						health += s;
						pts -= guy_cost.health;
						}
					break;

				case 3:
					if ( pts >= guy_cost.str && ( s > 0 || str ) ) {
						str += s;
						pts -= guy_cost.str;
						}
					break;

				case 4:
					if ( pts >= guy_cost.weapon && ( s > 0 || weapon ) ) {
						weapon += s;
						pts -= guy_cost.weapon;
						}
					break;

				case 5:
					if ( pts >= guy_cost.armor && ( s > 0 || armor ) ) {
						armor += s;
						pts -= guy_cost.armor;
						}
					break;

				}

			sprintf( screen.buff,"%s %4d",stat_line(buff),pts );
			screen.out_buff(x,y++,9+BACKGR );
			screen(x,y,"\xCD\xCD\xCD",0+BACKGR );

			}

		return( TRUE );
		}



// constructor - set to default
	guy_t::guy_t() {
		x = y = 0;

		skill = 6;
		str = 2;
		speed = 30;
		health0 = health = 2;

		weapon = 0;
		armor = 0;
		pop = 0;
		gold = 100;

		att0 = att = calc_att();

		state = GUY_OK;
		time = 0;
		human = FALSE;

		target = NULL;
		base = NULL;

		show_att = NULL;
		};



	void	guy_t::rand_guy( guy_list_t &base_list, int points, int v ){

		chart_t	chart;

		char	buff[80];


		// pick a random guy from list
		base = base_list[ R(0,base_list.num-1) ];
		strncpy( name,base->name,17 );


		// use name chart to build name
		//chart.read_file( "mglad.nam","Breton" );
		//strncpy( name,chart.build_name( buff ),17 );


		// set attributes - scale to base and randomize
		scale( *base, (points>v*3) ?points-v*3 :5 );

		// modify randomly to start
		skill  += R(0,v/guy_cost.skill);	if ( skill <= 0 ) skill = 2;
		str    += R(0,v/guy_cost.str);		if ( str <= 0 ) str = 2;
		health += R(0,v/guy_cost.health);	if ( health <= 0 ) health = 2;
		weapon += R(0,v/guy_cost.weapon);
		armor  += R(0,v/guy_cost.armor);

		health0 = health;
		att0 = att = calc_att();
		speed = calc_speed();

		};

//	figure a guy's point value
	int	guy_t::calc_points() {
		return(	skill * guy_cost.skill +
						str * guy_cost.str +
						health * guy_cost.health +
						weapon * guy_cost.weapon +
						armor * guy_cost.armor );

		};


// show a guy's hits/att in a bar
	void	guy_t::show_bar( Tscreen_t &screen, int x, int y ) {

		::show_bar( screen,x,y,	4,health0,health,	4,1 );
		::show_bar( screen,x+4,y++,	14,att0,att,	14,1 );

		};


// show a guy's stats on the screen
	void	guy_t::show_stats( Tscreen_t &screen, int x, int y, int bd ) {

		if ( bd != BD_NONE )
			screen.box( bd,x,y,x+17,y+9 );

		sprintf( screen.buff,"%-18s",name );
		screen.out_buff( x,y++,14+BACKGR );

		sprintf( screen.buff,"%7s%3d%8s","Skill:",skill,"Weapon" );
		screen.out_buff( x,y++,15+BACKGR );

		sprintf( screen.buff,"%7s%3d%+8d","Str:",str,weapon );
		screen.out_buff( x,y++,15+BACKGR );

		sprintf( screen.buff,"%7s%3d%8s","Speed:",speed,"Armor" );
		screen.out_buff( x,y++,15+BACKGR );

		sprintf( screen.buff,"%7s%3d%8d","Health:",health,armor );
		screen.out_buff( x,y++,15+BACKGR );

		// y++;	// blank line
		sprintf( screen.buff,"(%4d %4d %4d)",calc_points(),att,att0 );
		screen.out_buff( x,y++,15+BACKGR );

		sprintf( screen.buff,"health/attack:" );
		screen.out_buff( x,y++,15+BACKGR );

		show_bar( screen,x,y++ );

		sprintf( screen.buff,"%-10s%8s","Popularity","Gold" );
		screen.out_buff( x,y++,0+BACKGR );

		sprintf( screen.buff,"% -9d%8d",pop,gold );
		screen.out_buff( x,y++,0+BACKGR );

		}


// show a blank window, same size as stat window
	void	guy_t::blank_stats( Tscreen_t &screen, int x, int y, int bd ) {

		if ( bd != BD_NONE )
			screen.box( bd|_GFILLINTERIOR,x,y,x+17,y+9 );

		}


// various display routines
	void	guy_t::show( map_t &map ) {
		if ( state )
			map.plot( x,y,ch,at );
		else
			blank( map );
		};

	void	guy_t::show_hit( map_t &map ) {
		sound( 300 );	// 300
		map.blip( x,y,'*',4+BACKGR,150 );
		nosound();
		};

	void	guy_t::show_blink( map_t &map ) {
		sound( 20*att/att0+180 );	// 180-200
		map.blip( x,y,BLOCK,12+BACKGR,300 );
		nosound();
		};

	void	guy_t::show_attack( map_t &map ) {
		sound( 40*att/att0+200 );	// 220-240
		if ( (at&0xF0) == 4*16 )
			map.blip( x,y,ch,(at&0x0F)|(7*16),100 );
		else
			map.blip( x,y,ch,(at&0x0F)|(4*16),100 );
		nosound();
		};

	void	guy_t::show_rest( map_t &map ) {
//		map.blip( x,y,BLANK,0+BACKGR,200 );
		map.blip( x,y,BLOCK,at,200 );
		};


	void	guy_t::show_kill( map_t &map ) {
		sound( 75 );
		map.blip( x,y,'\x0f',4+BACKGR,75 );
		map.blip( x,y,'*',4+BACKGR,75 );
		map.blip( x,y,'\x0f',4+BACKGR,75 );
		map.blip( x,y,'*',4+BACKGR,75 );
		map.blip( x,y,'\x0f',4+BACKGR,75 );
		map.blip( x,y,'*',4+BACKGR,75 );
		nosound();
		};

// mechanics functions

// do rest at end of turn - and advance time
	void	guy_t::rest( int st ) {

		switch( st ) {

			case GUY_REST:

				att += (att0-att+1)/2;

				advance_time( 2 );
				break;

			case GUY_ATTACK:

				att--;

				advance_time( 2 );
				break;

			case GUY_DEFEND:

				att--;
				break;


			case GUY_HIT:	// hit, restore random att

				att += R(1,health0);
				break;

			case GUY_MOVE:
			default:

				// must roll skill less than str to rest
				if ( att < att0 && R(0,skill) < str )
					att += (att0-att+1)/3;

				advance_time( 1 );
				break;

			}

		if ( att > att0 ) att = att0;
		if ( att < 1 ) att = 1;

  	};


// attack another guy
	int	guy_t::attack( map_t &map, guy_t &def ) {

		int	ra,rd;

		char	buff[40];

		// show the attack
		show_attack( map );

		// compare randomized attack values
		ra = R(1,6) + R(0,att) + weapon;
		rd = R(1,6) + R(0,def.att)/2 + def.armor;


		sprintf( buff, "[%d:%d] %d-%d (%d) ",
				6+att+weapon,6+def.att+def.armor,ra,rd,ra-rd+str );

		if ( show_att )
			strcpy( show_att,buff );
		else if ( def.show_att )
			strcpy( def.show_att, buff );
		else {
			strcpy( map.screen->buff, buff );
			map.screen->out_buff( 0,0,12 );
			}

		// see who got hit
		if ( ra >= rd ) {
			def.hit( map, (ra - rd)/2 + str + weapon - def.armor );
			}
		else {
			// rest( GUY_ATTACK );	// lose an extra att point
			att += ra - rd + str - 1;	// lose some att, high str helps
			if ( att < 1 ) att = 1;
			if ( att > att0 ) att = att0;

			show_blink( map );
			}

		delay( 500 );

		// check for 0 att - attacker can't be hit by own attack
		if ( att < 1 ) att = 1;

		// defender loses att point
		def.rest( GUY_DEFEND );

		return( TRUE );
		}


// apply a hit to a guy
	int	guy_t::hit( map_t &map, int d ) {

		show_hit( map );	// show the hit - longer if multiple hits

		if ( d < 0 ) return( FALSE );

		att -= d;	// reduce att

		while ( att < 1 ) {
			if ( health ) health--;	// take a hit

			att += R(1,health0+health);	// restore att after hit

			show_hit( map );	// show the hit - longer if multiple
			}

		if ( att > att0 ) att = att0;

		if ( ! health ) kill( map );

		return( TRUE );
		}

// kill a guy
	int	guy_t::kill( map_t &map ) {

		state = GUY_DEAD;
		health = 0;
		att = 0;

		if ( ! map.check( *this,FL_BLOOD ) ) {
			map.set( *this,T_BLOOD );
			map.show( *this );
			}

		show_kill( map );
		blank( map );

		return( TRUE );
		}


/*
 * Other guy support routines
 */


