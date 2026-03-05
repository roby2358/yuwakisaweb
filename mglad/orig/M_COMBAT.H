
#ifndef __M_COMBAT_H
#define __M_COMBAT_H

// a base class for handling combats. Uses guy_list as its base
// note that extention classes will overwrite member functions
class	combat_t: public guy_list_t	{

public:

	map_t	map;

	int	rounds;	// rounds until declare a draw


	// constructor
	combat_t() {
		guy = NULL;
		num = 0;
  	};

	// combat main routine
	virtual int	do_combat( Tscreen_t &screen, guy_list_t &gl, int mult );

	// mechanics functions
	virtual int	gen_map( Tscreen_t &screen );

	virtual void	place_guys();

	virtual void	do_fight( Tscreen_t &screen  );

	virtual void	do_reward( Tscreen_t &screen, int mult );


	// functions to handle combat
	virtual int	move_human( Tscreen_t &screen, int n, int tt );
	virtual int	move_computer( Tscreen_t &screen, int n, int tt );

	};

#endif
