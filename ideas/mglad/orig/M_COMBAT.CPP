
// support routines for combat objects


#include	"m_func.h"


// main combat routine to do the combat
int	combat_t::do_combat( Tscreen_t &screen, guy_list_t &gl, int mult ) {


	// point to base guy list - rank the list passed
	num = gl.num;
	guy = gl.guy;

	// set up arena map
	gen_map( screen );							// generate the map
	place_guys();	// put guys on the map

	// do combat
	do_fight( screen );

	// mete out rewards
	do_reward( screen,mult );

	// de-assign guy list when done with it
	num = 0;
	guy = NULL;

	return(AR_OK);
	};


// generate the arena map
int	combat_t::gen_map( Tscreen_t &screen ) {

	// set up the map & terrain types
	map.init( screen,19,19 );
	map.set_border( BD_IN );

	map.terrain = new terrain_t[NUM_TERRAIN];
	if ( ! map.terrain ) return( FALSE );

	// set up terrain types

	map.terrain[T_CLEAR].set( '.',BLANK, BACKGR+8, 0 | FL_BLOOD );
	map.terrain[T_SAND].set( BLOCK,BLOCK, 14, FL_TERR | FL_BLOOD );
	map.terrain[T_TREE].set( '\x06',BLANK, BACKGR+2, FL_TERR | FL_NOMOVE );
	map.terrain[T_BUSH].set( '*',BLANK, BACKGR+2, FL_TERR );
	map.terrain[T_ROCK].set( '\xDC',BLANK, BACKGR+6, FL_TERR | FL_NOMOVE );
	map.terrain[T_POOL].set( BLOCK,BLOCK, 9, FL_TERR | FL_NOMOVE );
	map.terrain[T_COLUMN].set( '\xFE',BLANK, BACKGR+8, FL_TERR | FL_NOMOVE );
	map.terrain[T_LTWALL].set( '\xB0','\xB0', 7*16+8, FL_TERR | FL_NOMOVE );
	map.terrain[T_DKWALL].set( BLOCK,BLOCK, 8, FL_TERR | FL_NOMOVE );
	map.terrain[T_BLOOD].set( '\x0f',BLANK, 4+BACKGR, FL_TERR );


	switch ( R(1,4) ) {
		case 1:
			forest_map( map );
			break;

		case 2:
			arena_map( map );
			break;

		case 3:
			ruins_map( map );
			break;

		case 4:
			rocky_map( map );
			break;

		}

	return( TRUE );

	}



// put the guys on the map
void	combat_t::place_guys() {

	for ( start() ; g ; next() ) {

//		do {
			map.rnd_revcent( g->x,g->y,FL_NOMOVE );
//			} while ( at( *g ) > -1 );

		}

	};



// do the combat until one left
void	combat_t::do_fight( Tscreen_t &screen  ) {

	int	i,t;


	// show info
	screen_fade( screen );

	map.show();
	show_all( map );
	guy->blank_stats( screen, 41,1, BD_IN );
	guy->blank_stats( screen, 61,1, BD_IN );

	rounds = 0;

	// go while more than one alive & less than 30 rounds between kills
	while ( num_alive() > 1 && rounds < 1200 ) {

		show_stats( screen, 41,16 );

		t = min_time();

		rounds += t;

		for ( start(),i=0 ; g ; next(),i++ )

			if ( g->human )
				move_human( screen, i, t );
			else
				move_computer( screen, i, t );

		sprintf( screen.buff,"kill time: %d  ",1200-rounds );
		screen.out_buff( 2,23,0+BACKGR );

		};

	if ( rounds >= 1200 ) kill_all( map );

	}



// do rewards at end of the match - simple for now
void	combat_t::do_reward( Tscreen_t &screen, int mult ) {

	int	place,earned,x,y;


	place = 4;

	for ( start() ; g ; next() ) {

		g->pop += (place--) * mult;		// give pop points, then reduce for next guy


		// give gold, minimum PT_COST - get free 1000 gold if less than.
		if ( g->pop > 0 )
			g->gold += (earned = sqrt(g->pop) * POP_REWARD );
		else
			earned = 0;

		if ( ! g->human && g->gold < PT_COST )	g->gold += PT_COST;

		if ( g->human ) {

			x = 41;
			y = 5;
			screen.box( BD_OUT|_GFILLINTERIOR,x,y,78,y+5);

			screen( 45,++y,g->name,15+BACKGR );

			sprintf( screen.buff,"Popularity %5d ",g->pop );
			screen.out_buff( 45,++y,14+BACKGR );

			sprintf( screen.buff,"Credits earned:  %5dC ",earned );
			screen.out_buff( 45,++y,0+BACKGR );

			sprintf( screen.buff,"Current credits: %5dC ",g->gold );
			screen.out_buff( 45,++y,0+BACKGR );

			getch();

			}

		}

	}


