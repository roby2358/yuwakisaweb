
// support routines for combat objects


#include	"m_func.h"



// arena routines

	// constructor
	arena_t::arena_t() {

		// set defaults
		min_pop = -10;
		max_pop = 50;
		mult_pop = 1;

		pop_reward = POP_REWARD;
		pt_cost = PT_COST;

		base_points = 30;
		base_var = 6;


		guy = NULL;	// init guy_list when generate the roll

		};



	// generate the arena roll
	void	arena_t::gen_list( Tscreen_t &screen, guy_list_t &base, guy_t &g0 ) {


		// set up base list - save for making new guys later
		base_list = &base;


		// if no list, create it
		if ( ! guy ) init(8);

		// guy(human) starts at end
		memcpy( guy+num-1, &g0, sizeof(guy_t) );

		// fill other spots with random guys
		// go through; fill in empty slots with new guys
		for ( start() ; g ; next() )
			if ( ! g->state ) new_guy( *g );


		// show the arena roll
		screen_fade( screen );
		screen.box( BD_OUT|_GFILLINTERIOR,21,8,59,15 );
		show_stats2( screen, 21,8 );
		getch();

		};



// generate a new guy
void	arena_t::new_guy( guy_t &g ) {

	char	p;


	// generate a random guy
	g.rand_guy( *base_list,base_points,base_var );

	// Use first char of name, and pick color
	g.ch = *(g.name);
	g.at = R(8,15) + R(0,7) * 16;
	g.state = GUY_OK;
	g.pop = ( R(min_pop,max_pop) + R(min_pop,max_pop) ) / 3;
	g.gold = R(0,pt_cost);
	}



// restore all the guys for another fight
// modify computer guys based on gold
void	arena_t::restore_guys( Tscreen_t &screen ) {

	int	pts,pts0;

	char	buff[80];


	for ( start() ; g ; next() ) {

		// restore state & health
		g->state = GUY_OK;
		g->health = g->health0;


		// output stats for testing
		sprintf( screen.buff,"%s pop %2d, gold %6d  ",
			g->name,g->pop,g->gold );
		screen.out_buff( 1,1,15+BACKGR );

		if ( g->base ) {
			sprintf( screen.buff,"%s %4d %s  ",
				g->base->stat_line(buff),g->base->calc_points(),g->base->name );
			screen.out_buff( 2,2,0+BACKGR );
			}

		// if based on a base guy, scale and add points
		// else just scale down for damage
		if ( g->base ) {

			// points() gets used a lot, so calculate it once
			pts0 = g->calc_points();

			// scale to base, then add in extra points
			// subtract 5% (1/20) due to combat damage, wear & tear
			pts = pts0 + (g->gold / pt_cost) - pts0 / 20;

			sprintf( screen.buff,"%s %4d (%4d) %s  ",
				g->stat_line(buff),pts0,pts,"current" );
			screen.out_buff( 2,3,0+BACKGR );


			// scale to base, add/subtract to new points & spend gold
			g->scale( *(g->base),pts0 * 9 / 10 );

			g->modify( screen, pts - g->calc_points() );

			g->gold %= PT_COST;

			}
		else {
			// scale down for damage

			sprintf( screen.buff,"%s %4d (%4d) %s  ",
				g->stat_line(buff),g->calc_points(),pts,"current" );
			screen.out_buff( 2,3,0+BACKGR );

			g->modify( screen, g->calc_points() / -20 );

			}

		g->health0 = g->health;	// adjust base health

		g->restore();

		getch();	// test pause
		}

	}


// promote/get rid of guys
	int	arena_t::promote_guys( Tscreen_t &screen ) {

		int x,y;

	 // if 1st guy above max pop, advance
	 if ( guy->pop >= max_pop ) {

		 // if below min pop, send back
		 if ( guy->human )
			 return( AR_PROMOTE );
		 else {
			 x = 41;
			 y = 5;
			 screen.box( BD_OUT|_GFILLINTERIOR,x,y,78,y+3);

			 screen( 45,++y,guy->name,15+BACKGR );

			 sprintf( screen.buff,"has advanced to the next tier.",guy->name );
			 screen.out_buff( 45,++y,14+BACKGR );

			 getch();

			 // get a replacement - advance roll & fill last spot
			 advance_guys( guy );
			 new_guy( *(guy+num-1) );

			 }

		 }

		for ( start() ; g ; next() ) {

			// if below min pop, send back
			if ( g->pop <= min_pop ) {

				if ( g->human )
					return( AR_DEMOTE );
				else {
					x = 41;
					y = 5;
					screen.box( BD_OUT|_GFILLINTERIOR,x,y,78,y+3);

					screen( 45,++y,g->name,15+BACKGR );

					sprintf( screen.buff,"is being sent back.",g->name );
					screen.out_buff( 45,++y,14+BACKGR );

					getch();

					// get a replacement - advance roll & fill last spot
					advance_guys( g );
					new_guy( *(guy+num-1) );
					}

				}

			}

		return( AR_OK );
		};


// show the guy's standings
	void	arena_t::show_standings( Tscreen_t &screen ) {
		screen_fade( screen );
		screen.box( BD_OUT | _GFILLINTERIOR, 1,16, 78,23 );
		show_pyramid( screen,*this );
		show_stats2( screen, 41,16 );

		getch();
		};


// do the arena

	int	arena_t::do_arena( Tscreen_t &screen, combat_t *combat )
	{

	char	ch;

	int	status;


  // start with all okay
  status = AR_OK;

	// check to see if any human players that need to buy
	for ( start() ; g ; next() )
		if ( g->human )
			status = do_buy( screen,*g );

	if ( status != AR_OK ) return(status);


	// do the event (later event->do_event)
	combat->do_combat(screen,*this,mult_pop);

	// restore guys & wrapup
	restore_guys( screen );		// get everyone ready for combat again


	// show the standings & promote/demote
	show_standings(screen);

	status = promote_guys(screen);

	if ( status != AR_OK ) return(status);

	};


// other support routines

/*
// return pointer to first human in list
guy_t	*human() {

	for ( start() ; g ; next() )
		if ( g->human ) return( g );

	};
*/