
// misc support functions for mglad

#include	"m_func.h"



// misc functions for monster gladiator

void	show_bar( Tscreen_t &screen, int x, int y, int size, int max, int v,
								char att1, char att2 )
{
int	n;


// print the first part of the bar
n = ( v * size + (max>>1) ) / max;

if ( n ) {
	memset( screen.buff,BLOCK,n );

	screen.buff[n] = '\0';						// chop off what we don't need
	screen.out_buff(x,y,att1);			// plot it
	}

// plot the rest of the bar
if ( n < size ) {
	memset( screen.buff,LTBLOCK,size-n );

	screen.buff[size-n] = '\0';
	screen.out_buff(x+n,y,att2);
	}

}


void	attack_bar( Tscreen_t &screen, guy_t &guy1, guy_t &guy2, int x, int y )
{
int	mx;

mx = max( guy1.att0, guy2.att0 );

sprintf( screen.buff,"%s %s", guy1.name, guy1.show_att );
screen.out_buff( x,y++,14+BACKGR );

show_bar( screen,x,y,	4,guy1.health0,guy1.health,	4,1 );
show_bar( screen,x+4,y++,	14,mx,guy1.att,	14,1 );

show_bar( screen,x,y,	4,guy2.health0,guy2.health,	4,1 );
show_bar( screen,x+4,y++,	14,mx,guy2.att,	9,1 );

screen( x,y++,guy2.name,14+BACKGR );
}



// check before an attack to see if need to show attack bar & stats
void	check_show_attack( Tscreen_t &screen, guy_t &guy1, guy_t &guy2 )
{

if ( guy1.show_att ) {
	attack_bar( screen,guy1,guy2,51,12 );
	guy1.show_stats( screen,41,1,BD_IN );
	guy2.show_stats( screen,61,1,BD_IN );
	}
else if ( guy2.show_att ) {
	attack_bar( screen,guy2,guy1,51,12 );
	guy2.show_stats( screen,41,1,BD_IN );
	guy1.show_stats( screen,61,1,BD_IN );
	}

}


// show the guys, pyramid fashion
	void	show_pyramid( Tscreen_t &screen, guy_list_t &guy_list ) {

		int	i,y;

		guy_t	*g;


		// start the guy list
		g = guy_list.guy;
		y = 1;

		// show the guys in a pyramid
		split_screen( screen,2,1,y,*g );
		g++;
		y+=2;

		split_screen( screen,3,2,y,*g );
		g++;
		y++;

		split_screen( screen,3,1,y,*g );
		g++;
		y+=3;

		split_screen( screen,6,1,y,*g );
		g++;
		y++;

		split_screen( screen,6,2,y,*g );
		g++;
		y++;

		split_screen( screen,6,3,y,*g );
		g++;
		y++;

		split_screen( screen,6,4,y,*g );
		g++;
		y++;

		split_screen( screen,6,5,y,*g );
		g++;

		}


// split the screen into columns
	void	split_screen( Tscreen_t &screen, int col, int n, int y, guy_t &guy ) {

		int	x;

		x = n*(screen.x2-screen.x1)/col+screen.x1;

		screen( x-strlen(guy.name)/2,y,guy.name,guy.at );


		sprintf( screen.buff,"II %3d II",guy.pop );
		screen.out_buff( x-strlen(screen.buff)/2,y+1,guy.at );

		}



// screen color fade routine
	void	screen_fade( Tscreen_t &screen, char attr, char *ch ) {

		int	num,lines,x,y,r;


		num = strlen( ch );
		lines = 25;

		for ( y = 0 ; y < lines ; y++ ) {

			for ( x = 0 ; x < 80 ; x++ ) {

				r = ( (y+1) * num * lines ) / (lines * R(1,2*lines) );

				if ( r >= num ) r = num - 1;

				screen( x,y,ch[r],attr );

				}

			}


		};
