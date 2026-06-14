
// include files for all the modules
// note that this is the only include file that contains includes

#include	<stdio.h>
#include 	<conio.h>
#include	<stdlib.h>
#include	<dos.h>
#include	<string.h>
#include	<math.h>

// support files
#include  "stuff.h"

#include	"Tscreen.h"

#include	"map.h"


// includes for monster gladiators
#include	"mglad.h"

#include	"m_guy.h"

#include	"m_combat.h"

#include	"m_arena.h"

#include	"m_global.h"




// prototypes for various support files for mglad


// prototypes for m_map.cpp
void	change_background( map_t &map, int backgr );
void	arena_map( map_t &map );
void	forest_map( map_t &map );
void	ruins_map( map_t &map );
void	rocky_map( map_t &map );

// prototypes for m_misc.cpp
void	show_bar( Tscreen_t &screen, int x, int y, int size, int max, int v,
								char att1, char att2 );


void	attack_bar( Tscreen_t &screen, guy_t &guy1, guy_t &guy2, int x, int y );

void	check_show_attack( Tscreen_t &screen, guy_t &guy1, guy_t &guy2 );

void	show_pyramid( Tscreen_t &screen, guy_list_t &guy_list );

void	split_screen( Tscreen_t &screen, int col, int n, int y, guy_t &guy );

void	screen_fade( Tscreen_t &screen, char attr = 9+BLUEBK, char *ch = " \xb0\xb1\xb2\xdb" );


// support routines
void	setup_guys( guy_list_t &base_guys, guy_t &guy );

void awakening();

void	passage();

void	demote();
