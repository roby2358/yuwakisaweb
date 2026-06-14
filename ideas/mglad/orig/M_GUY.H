
// define a class to handle guys


#ifndef __M_GUY_H
#define __M_GUY_H


enum state_t	{ GUY_DEAD,
								GUY_OK,
								GUY_MOVE,
								GUY_ATTACK,
								GUY_DEFEND,
								GUY_REST,
								GUY_HIT };

#define ATT_SLOW	10

// set up for guy lists
class	guy_list_t;


// structure for guy's stats
struct	stat_t	{

	uchar	skill,
				str,
				health,
				weapon,
				armor;

	// print stats into a buffer
	char	*stat_line( char *buff );

	// modify a guy's stats
	void	scale( 	stat_t &base, int points );
	int	modify( Tscreen_t &screen, int pts );

	};


class	guy_t: public point_t, public stat_t
{

public:

	// character attributes

	char	name[20],
				*show_att;

	int	att,att0,		// attack value and base attack

		speed,				// guy's speed

		health0,			// base health value

		pop,				// guy's popularity

		time,				// time until next move

		human;			// human or not

	long	gold;		// money

	char	ch,at;	// character and attribute

	guy_t *target,	// pointer to target
  			*base;		// pointer to base guy

	state_t	state;


	// set a guy up with defaults
	guy_t();


	// figure a guy's point value
	int	calc_points();


	// calculate average attack strength
	int	calc_att_str() { return( (att0+7+weapon+armor)/2 ); };


	// calculate the guy's speed
	int	calc_speed() {
		unsigned int	s;

		s = (60 * calc_points()) / (skill * str);

		return( (s <= 10) ?10 :( (s<30) ?s : 30 ) );
		}

	// calculate a guy's base attack
	uchar	calc_att() { return( skill+str );	};


	// advance time by a number of moves
	int	advance_time( int	tt )	{
		return( time += tt * ( speed + (ATT_SLOW-ATT_SLOW*att/att0) ) );
		};


	// set a guy's attributes
	void	set( char *n, uchar a, uchar b, uchar d, uchar e, uchar f ) {
		strncpy( name,n,18 );

		skill = a;
		str = b;
		health0 = health = d;
		weapon = e;
		armor = f;

		att0 = att = calc_att();
		speed = calc_speed();
		};

	void	rand_guy( guy_list_t &base_list, int points, int v );

	// show a guy's stats or a blank window
	void	show_bar( Tscreen_t &screen, int x, int y );
	void	show_stats( Tscreen_t &screen,int x, int y, int bd );
	void	blank_stats( Tscreen_t &screen, int x, int y, int bd );


	// various display routines
	void	show( map_t &map );
	void	blank( map_t &map ) {	map.show( x,y );	};
	void	show_hit( map_t &map );
	void	show_blink( map_t &map );
	void	show_attack( map_t &map );
	void	show_rest( map_t &map );
	void	show_kill( map_t &map );

	int	attack( map_t &map, guy_t &guy );	// do an attack on a guy
	int	hit( map_t &map,int dmg );	// apply a hit to the guy
	int	kill( map_t &map );	// kill a guy

	void	rest( int st );	// do rest/guard/restore - adjustments to att

	void	restore() {	// restore a guy to original status
		health = health0;
		att = att0 = calc_att();
		};

};


class	guy_list_t
{

	int	i;			//	number of current guy

public:

	int	num;

	guy_t	*guy,	// pointer to guy list
				*g;		// pointer to current guy


	// creator & destructor - n guys, delete when destruct
	guy_list_t()	{ num = i = 0; guy = g = NULL; };
	void init( int n ) {
		guy = new guy_t[n];
		memset( guy,0,sizeof(guy_t)*n );
		num = n;
		};
	guy_list_t( int n ) {	init(n);	};
	~guy_list_t() {	if ( guy ) delete guy; guy = NULL;	};

	// routines for traversing list
	guy_t	*start();
	guy_t *next();

	// determine if char & attribute not used yet
	unique_char( char ch, char at );
	unique_clr( char at );

	// misc routines
	int	min_time();
	int	num_alive();

	// show all the guys
	void show_all( map_t &map );

	void	show_stats( Tscreen_t &screen, int x, int y );
	void	show_stats2( Tscreen_t &screen, int x, int y );

	// return the number of a guy at a location, -1 of none
	int	at( int x, int y );
	int	at( point_t &p )	{ return( at( p.x,p.y ) ); };

	// return a guy index if an adjacent guy
	int	adjacent( map_t &m, int x, int y );
	int adjacent( map_t &m, point_t &p )	{ return( adjacent( m,p.x,p.y ) ); };

	// return a guy index for the closest guy
	int	closest( map_t &m, int x, int y );
	int	closest( map_t &m, point_t &p ) { return( closest(m,p.x,p.y) ); };

	// adjust the rank of two guys - a before b
	int	rank( int a, int b );

	// advance rolls - leave space at end
	void	advance_guys( guy_t *gg );

	// return a pointer to a guy
	guy_t *operator [] ( int n ) {

		return( (n>-1 && n<num) ?guy+n :NULL );

		};

	void	kill_all( map_t &map );


};


// support routines
void	setup_guys( guy_list_t &base );


#endif
