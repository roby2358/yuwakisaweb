
// map routines for mglad.cpp

#include	"map.h"

#include	"mglad.h"




// change the background of the terrain
void	change_background( map_t &map, int backgr )
{
int	i;

for ( i = 0 ; i < NUM_TERRAIN ; i++ )
	if ( (map.terrain[i].at & 0xF0) == BACKGR )
		map.terrain[i].at = ( map.terrain[i].at & 0x0F ) | backgr;

}




// map generator functions

void	arena_map( map_t &map )
{
int	i,j,halfx,halfy;

map.clear(T_SAND);
map.round_border( 2,T_DKWALL,T_LTWALL );

}


void	forest_map( map_t &map )
{
int	i,x,y;


map.clear();
map.round_border( 3,T_TREE,T_ROCK );

// put some trees & stuff
for ( i = 0 ; i < 20 ; i++ ) {
	map.rnd_revcent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_TREE );

	map.rnd_revcent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_TREE );

	map.rnd_revcent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_TREE );

	map.rnd_spot( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_BUSH );

	map.rnd_revcent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_BUSH );

	map.rnd_spot( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_ROCK );

	map.rnd_cent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_POOL );

	}

}


void	ruins_map( map_t &map )
{
int	i,j,x,y;


map.clear();
map.round_border( 3,T_ROCK,T_COLUMN );

// put some trees & stuff
for ( i = 0 ; i < 10 ; i++ ) {
	map.rnd_spot( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_ROCK );

	map.rnd_revcent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_BUSH );

	map.rnd_spot( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_DKWALL );

	map.rnd_revcent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_DKWALL );

	map.rnd_revcent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_LTWALL );

	map.rnd_spot( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_COLUMN );

	}

// the rest is sand
for ( i = 0 ; i < map.maxx ; i++ )
	for ( j = 0 ; j < map.maxy ; j++ ) {

		if ( *map(i,j) == T_CLEAR )
			map.set( i,j, T_SAND );
		}


}



void	rocky_map( map_t &map )
{
int	i,j,x,y;


map.clear();
map.round_border( 3,T_ROCK,T_TREE );

// put some trees & stuff
for ( i = 0 ; i < 30 ; i++ ) {
	map.rnd_spot( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_ROCK );

	map.rnd_revcent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_ROCK );

	map.rnd_spot( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_BUSH );

	map.rnd_spot( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_SAND );

	map.rnd_cent( x,y,FL_TERR );	// find a random spot with no terrain
	map.set( x,y,T_SAND );

	}

}


