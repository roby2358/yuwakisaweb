
/* mglad.cpp - monster gladiator
 *
 * version 1.1 - Rob Young, 01/01/80
 *
 * Basic platform for arena combat game. Simple coded routines
 * for characters, enemies, maps and rewards.
 *
 * ANSI graphics - graphics versions to follow
 *
 */



// include files & function definitions

#include "m_func.h"


/* global variables */




int	main( /* int argc, char **argv */ )
{
Tscreen_t screen(BACKGR);

guy_list_t base_guys;

guy_t	guy0;	// player's guy

arena_t	*arena;

combat_t	*combat;

int	result;



/* function body */

randomize();
screen.setcursor( CURSOR_OFF );


// set up the guys, create the arena & set up roll
setup_guys( base_guys,guy0 );

arena = new arena_t();

arena->gen_list( screen,base_guys,guy0 );

arena->set_pop( -5,25,2 );


// set up the combat
combat = new combat_t;


do {

	result = arena->do_arena( screen,combat );


	switch ( result ) {

		case AR_OK:
			// null case
			break;

		case AR_QUIT:
			// save the game
			break;

		case AR_PROMOTE:
		case AR_PASSAGE:
			// passage to another arena
			passage();
    	break;

		case	AR_DEMOTE:
			demote();
			break;

		};

	} while ( result == AR_OK );


switch ( result ) {

	case AR_PROMOTE:
		screen( 2,20,"You made it to the next tier!",12+BACKGR );
		break;

	case AR_DEMOTE:
		screen( 2,20,"You have been sent back.",12+BACKGR );
		break;

	case AR_QUIT:
		screen( 2,20,"Thanks for playing!",12+BACKGR );
		break;

	};

delete combat;

delete arena;

screen.setcursor( CURSOR_NORMAL );
}






// set up the prototype guy list
void	setup_guys( guy_list_t &base, guy_t &g ) {

	int	i;

	// set up the base guy list
	base.guy = new guy_t[10];
	i = 0;

	base.guy[i++].set( "Standard",	20,10,12,  9, 6 );
	base.guy[i++].set( "Rock",			14,14,15,  14, 3 );
	base.guy[i++].set( "Brick",			15,14,15,  4, 9 );
	base.guy[i++].set( "Speedster",	31, 6,8,  7, 0 );
	base.guy[i++].set( "Master",		33, 6,20, 18, 0 );
	base.guy[i++].set( "Wall",			12,12,18,  4,12 );
	base.guy[i++].set( "Slasher",		10, 8,10, 24, 0 );
	base.guy[i++].set( "Specialist",64, 4,10,  4, 0 );
	base.guy[i++].set( "Monster",		15,15,17,  14, 3 );
	base.guy[i++].set( "Strongman",	25,24,15,  6, 0 );

	base.num = i;


	// initialize player
	g.set( "Guy1",6,4,5,0,0 );
	g.human = TRUE;
	g.show_att = new char[40];
	g.ch = '0';
	g.at = 15+0*16;


	};


// routine to start the whole thing
	void awakening() {
		};

// routine to go to another arena
	void	passage() {
		};

// routine to demote within an arena
	void	demote() {
		};
