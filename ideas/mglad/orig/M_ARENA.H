
// header file for arena and combat objects

#ifndef __M_ARENA_H
#define __M_ARENA_H


// enum to specify arena outcomes
enum arena_result	{ AR_QUIT,AR_OK,AR_PASSAGE,AR_PROMOTE,AR_DEMOTE };


// class to define an arena
class	arena_t: public	guy_list_t	{

	public:

	char	*name;		// arena name (includes tier)

	int	max_pop,min_pop,mult_pop,
			pop_reward,pt_cost,
			base_points,base_var;

	guy_list_t	*base_list;		// pointer to guy base types


	// setup routines
	arena_t();

	void	set( char *nm, int mn, int mx, int mul ) {

		// general-purpose set routine
		// most values default, others are calculated

		name = nm;

		min_pop = mn;
		max_pop = mx;
		mult_pop = mul;

		pop_reward = POP_REWARD;
		pt_cost = PT_COST;

		base_points = (sqrt( (min_pop+max_pop)/2 ) * pop_reward / pt_cost ) * 20;
		base_var = 6;

		};

	void	set_pop( int mn, int mx, int mul ) {
		min_pop = mn;
		max_pop = mx;
		mult_pop = mul;
		};

	void	set_credits( int reward,int cost ) {
		pop_reward = reward;
		pt_cost = cost;
		};

	void	set_base( int b,int v ) {
		base_points = b;
		base_var = v;
  	};


	// main routines for arena
	virtual int		do_arena( Tscreen_t &screen, combat_t *combat );

	virtual void	new_guy( guy_t &g );	// create a guy in a list

	virtual void	gen_list( Tscreen_t &screen,guy_list_t &base, guy_t &guy );

	virtual void	restore_guys( Tscreen_t &screen );

	virtual	void	show_standings( Tscreen_t &screen );

	virtual int		promote_guys( Tscreen_t &screen );

	virtual int	do_buy( Tscreen_t &screen, guy_t &guy );

	virtual void	buy_stats( Tscreen_t &screen, guy_t &guy, int pts );


	// returns a pointer to the first human character
	guy_t *human();


	// routine to erase the list once you're done with it
	void	clear_list() {
		num = 0;
		if ( guy ) delete guy;
		guy = NULL;
		};

	};


	/*
// and a class to define worlds
// worlds consist mostly of lists of arenas and lists of combats (events)
// note that buying is a function of world_t

class	world_t	{

	public:

	char	*name;

	int	num_tiers,num_events;

	arena_t	*arena;	// pointer to list of arenas

	combat_t	(*event)[];	// list of combat pointers for different events


	// member functions
	world_t() {
		name = NULL;
		arena = NULL;
		event = NULL;

		num_tiers = 0;
		num_events = 0;
		};

	int	rank( guy_t &guy );

	virtual int	start( Tscreen_t &screen, guy_t &guy, int tier );

	virtual int	promote( Tscreen_t &screen, guy_t &guy, int tier );

	virtual int	demote( Tscreen_t &screen, guy_t &guy, int tier );

	virtual combat_t	*select_event();

	};
*/

#endif

