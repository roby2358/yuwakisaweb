
// GUY_LIST routines


#include	"m_func.h"


extern stat_t	guy_cost;


// start traversing the list
	guy_t	*guy_list_t::start() {

		i = 0;

		return( g = ( (num) ?guy :NULL ) );
		}


// return next guy, NULL if done
	guy_t	*guy_list_t::next() {

		return( (++i<num) ?++g :g=NULL );
		}


// determine if char & attribute not used yet
	guy_list_t::unique_char( char cc, char aa ) {

		for ( start() ; g ; next() ) // go through, stop if match
			if ( g->state && g->ch == cc && g->at == aa )
				return( FALSE );

		return( TRUE );
		};


// determine if attribute not used yet
	guy_list_t::unique_clr( char at ) {
		int	i;

		guy_t	*g;


		for ( i = 0, g = guy ; i < num ; i++,g++ ) // go through, stop if match
			if ( g->state && at == g->at )
				return( FALSE );

		return( TRUE );
		};


// show all the guys
	void	guy_list_t::show_all( map_t &map ) {

		int	i;

		guy_t	*g;

		for ( i = 0, g = guy ; i < num ; i++, g++ )
			g->show( map );

  	}


// return the number of a guy at a location, -1 of none
	int	guy_list_t::at( int x, int y )	{

		int	i;

		guy_t	*g;


		// go through, if found, return #
		for ( i = 0, g = guy ; i < num ; i++,g++ )
			if ( g->state && x == g->x && y == g->y ) return(i);

		// none, return -1
    return(-1);

		};

// return a guy index if an adjacent guy
	int	guy_list_t::adjacent( map_t &m, int x, int y ) {

		int	i;

		guy_t	*g;


		// go through, if found, return #
		for ( i = 0, g = guy ; i < num ; i++,g++ )
			if ( g->state && m.adjacent( g->x,g->y,x,y )
						&& (x != g->x || y != g->y) ) return(i);

		// none, return -1
		return(-1);

		};


// return a guy index for the closest guy
	int	guy_list_t::closest( map_t &m, int x, int y ) {

		int	i,n,d,dd;

		guy_t	*g;

		n = -1;
		d = 1000;	// pick the nearest alive guy

		// go through to find smallest d
		for ( i = 0,g = guy ; i < num ; i++,g++ ) {

			if ( g->state && (g->x != x || g->y != y) ) {
				dd = m.range( x,y,g->x,g->y );

				if ( dd < d ) {	n = i;	d = dd;	}
				}

			}

		// return the closest guy's index - -1 if none
		return(n);

		};


// find the minimun move time in the list
	int	guy_list_t::min_time() {

		int	t;

		t = 1000;	// start high

		for ( start() ; g ; next() )

			if ( g->state && g->time < t ) t = g->time;

		return( t );

		};


// find the number of guys still alive
	int	guy_list_t::num_alive() {

		int	n;

		n = 0;

		for ( start() ; g ; next() )

			if ( g->state ) n++;

		return( n );

		};


// show a list of the guys
	void	guy_list_t::show_stats( Tscreen_t &screen, int x, int y ) {

		for ( start() ; g ; next() ) {
			sprintf( screen.buff,"%11.11s",g->name );
			screen.out_buff( x,y,(g->state) ?0+BACKGR :4+BACKGR );

			screen( x+13,y,g->ch,g->at );
			sprintf( screen.buff,"%3d", g->calc_att_str() );
			screen.out_buff( x+15,y,(g->state) ?0+BACKGR :4+BACKGR );

			g->show_bar( screen,x+20,y++ );

			}

		};


// alternate to show a list of the guys
	void	guy_list_t::show_stats2( Tscreen_t &screen, int x, int y ) {

		for ( start() ; g ; next() ) {
			sprintf( screen.buff,"%11.11s",g->name );
			screen.out_buff( x,y,(g->state) ?0+BACKGR :4+BACKGR );

			screen( x+13,y,g->ch,g->at );
			sprintf( screen.buff,"%3d (%3d) p%3d, %5dC",
				g->calc_att_str(),
				g->calc_points(),
				g->pop,
				g->gold );
			screen.out_buff( x+15,y++,(g->state) ?0+BACKGR :4+BACKGR );

			}

		};

// advance the roll from end of list into a guy
	void	guy_list_t::advance_guys( guy_t *gg ) {

		int	size;

		size = (num - (gg - guy) - 1) * sizeof(guy_t);

		if ( size )	memmove( gg,gg+1,size );

		};

// adjust the rank of two guys - a before b
	int	guy_list_t::rank( int a, int b ) {

		guy_t	temp,*f,*t;

		size_t size;


		if ( a < b ) return( TRUE );	// already in order

		memcpy( &temp,guy+a,sizeof(guy_t) );

		f = guy+b;
		t = guy+b+1;
		size = (a - b) * sizeof( guy_t );

		if ( size )	memmove( t,f,size );

		memcpy( guy+b,&temp,sizeof(guy_t) );	// copy the top guy in

		return( TRUE );
		};


// kill the whole list
	void	guy_list_t::kill_all( map_t &map ) {

		for ( start() ; g ; next() )

			if ( g->state ) g->kill(map);

		};


