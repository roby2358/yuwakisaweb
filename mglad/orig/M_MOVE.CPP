
// routines for moving the guys

#include	"m_func.h"


// move a human - get a key and move based on it
	int	combat_t::move_human( Tscreen_t &screen, int n, int tt ) {

		char	mm,targ;

		int	xx,yy;

		guy_t	*gg;


		// set pointer to the guy
		gg = guy+n;

		// if dead, no move
		if ( ! gg->state ) return( FALSE );

		// see if time for move yet -- if not, default to TRUE
		if ( (gg->time -= tt) > 0 ) return( TRUE );

		// show the guy's stats & arena roll
		gg->show_stats( screen, 41,1, BD_IN );
		//show_stats( screen,41,16 );

		// get the move
		mm = map.get_move( gg->x,gg->y );


		// if bad move or ESC, quit
		if ( ! mm || mm == '\x1b' )
			return( FALSE);
		else {

			switch ( mm ) {

				case 'm':				// redraw the map
					map.show();
					show_all(map);
					break;

				case 'k':				// kill all the guys
					kill_all( map );
					break;

				case 5:					// rest/guard

					gg->show_rest( map );
					gg->rest( gg->state = GUY_REST );
					return( TRUE );
					break;

				default:				// treat as movement

					xx = gg->x;
					yy = gg->y;
					map.closein( mm,xx,yy,1 );

					// if someone at location, attack
					targ = at( xx,yy );

					if ( targ > -1 && targ != n ) {	// attack

						gg->target = guy+targ;

						gg->attack( map,*gg->target );
						check_show_attack( screen,*g,*gg->target );

						// do rest/advance time
						gg->rest( gg->state = GUY_ATTACK );

						// if target killed, change rankings
						if ( ! gg->target->health ) {
							gg->pop++;				// popularity goes up
							rank( n,targ );	// rank ahead of victim

							rounds = 0;	// reset timer
							}

						return(TRUE);
						}
					else {

						gg->blank( map );

						gg->x = xx;
						gg->y = yy;

						gg->show( map );

						gg->rest( gg->state = GUY_MOVE );
						return(TRUE);
						}

					}

			return( TRUE );
			}

		}



// move the computer - basic strategy
	int	combat_t::move_computer( Tscreen_t &screen, int n, int tt ) {

		int	targ,mm,dx,dy,ra,rd,i;

		char	ch;

		guy_t	*g;

		path_t	path;


		// set pointer to the guy
		g = guy+n;

		// if dead, no move
		if ( ! g->state ) return( FALSE );

		// see if time for move yet -- if not, default to TRUE
		if ( (g->time -= tt) > 0 ) return( TRUE );

		// if an adjacent guy, attack him
		targ = adjacent( map,*g );

		if ( targ > -1 ) {
			g->target = guy+targ;

			ra = g->att+g->weapon;
			rd = g->target->att+g->target->armor;

			// if less than even odds, guard; otherwise, attack
			if ( (g->att < g->att0)	&& ( ra < rd-1 ) ) {

				// rest/guard
				g->show_rest( map );
				g->rest( g->state = GUY_REST );
				}
			else {

				// see if shift, else attack

				if ( R(0,ra) < R(0,rd) ) {
					// move (shift), then advance time & set state
					g->target = guy+targ;

					mm = map.delta( *g, *g->target,0,dx,dy );
					map.move_list( path, mm,g->x,g->y,1 );


					// use closein to close in on the target
					g->blank( map );

					// find the first unoccupied space - skip first one
					path.start();
					while ( path.next() && at( path.x,path.y ) > -1 ) ;

					if ( path.valid_point() ) {
						g->x = path.x;
						g->y = path.y;
						}

					g->show( map );

					// time is based on guy's speed
					g->rest( g->state = GUY_MOVE );
					return( TRUE );

					}
				else {
					// attack

					g->attack( map,*g->target );
					check_show_attack( screen,*g,*g->target );

					g->rest( g->state = GUY_ATTACK );

					// if target killed, change rankings
					if ( ! g->target->health ) {
						g->pop++;				// popularity goes up
						rank( n,targ );	// rank ahead of victim

						rounds = 0;	// reset timer
						}

					}

				}

			return( TRUE );
			}
		else {

			// pick the target - the closest guy & get move
			targ = closest( map,*g );

			if ( targ == -1 ) return( FALSE );	// no more opponents

			g->target = guy+targ;

			mm = map.delta( *g, *g->target,0,dx,dy );


			// use closein to close in on the target
			g->blank( map );

			map.closein( mm,g->x,g->y,1 );

			g->show( map );

			// time is based on guy's speed
			g->rest( g->state = GUY_MOVE );
			return( TRUE );
			}

		}

