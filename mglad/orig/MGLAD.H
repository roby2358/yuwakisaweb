
// defines & enums for monster gladiators


#ifndef __MGLAD_H
#define __MGLAD_H

enum	terr_t	{	T_CLEAR,
								T_SAND,
								T_TREE,
								T_BUSH,
								T_ROCK,
								T_POOL,
								T_COLUMN,
								T_LTWALL,
								T_DKWALL,
								T_BLOOD,
								NUM_TERRAIN	};


#define FL_NOMOVE	1
#define FL_TERR	2
#define FL_BLOOD	4

#define BACKGR (7*16)
#define BLUEBK (1*16)


// defines - later will be array by planet
#define PT_COST	100
#define POP_REWARD	40


#endif

