
// routines for spending points

#include	"m_func.h"

#include	"menu.h"


#define LO 0+16*7
#define HT 15+16*7
#define HI 15+16*2
#define NO 8+16*7


extern stat_t	guy_cost;


// top-level buying routine
	int 	arena_t::do_buy( Tscreen_t &screen, guy_t &guy ) {

		menu_t	menu;

		int	n;

		char	ch;


		// set up the menu
		n = 0;

		menu.set( 8, 41,5, 75,13, BD_OUT|_GFILLINTERIOR,".TEHOnMA\n\x1b " );
		menu.item[n++].set( 2,n, LO,HT,HI,NO, "Train in Gym             FREE",'T',I_ON );
		menu.item[n++].set( 2,n, LO,HT,HI,NO, "Extensive Training        200",'E',guy.gold >= 200 );
		menu.item[n++].set( 2,n, LO,HT,HI,NO, "Hire a Trainer            300",'H',guy.gold >= 300 );
		menu.item[n++].set( 2,n, LO,HT,HI,NO, "Outpaitent Bioengineering 500",'O',guy.gold >= 500 );
		menu.item[n++].set( 2,n, LO,HT,HI,NO, "Minor Bioengineering      800",'n',guy.gold >= 800 );
		menu.item[n++].set( 2,n, LO,HT,HI,NO, "Major Bioengineering     1200",'M',guy.gold >= 1200 );
		menu.item[n++].set( 2,n+1, LO,HT,HI,NO, "Buy Passage             1000",'P',guy.gold >= 1000 );
		menu.item[n++].set( 2,n+2, LO,HT,HI,NO, "Quit",'Q',TRUE );

		screen_fade( screen );

		guy.blank_stats( screen,10,5,BD_OUT );
		guy.show_stats( screen,10,5,BD_OUT );

		screen.box( menu.border,menu.x1,menu.y1,menu.x2,menu.y2 );

		n = 0;
		menu.get( screen,n );

		switch ( n ) {

			case 0:
				buy_stats( screen,guy,1 );
				return( AR_OK );
				break;

			case 1:
				guy.gold -= PT_COST * 2;
				buy_stats( screen,guy,2 );
				return( AR_OK );
				break;

			case 2:
				guy.gold -= PT_COST * 3;
				buy_stats( screen,guy,3 );
				return( AR_OK );
				break;

			case 3:
				guy.gold -= PT_COST * 5;
				buy_stats( screen,guy,5 );
				return( AR_OK );
				break;

			case 4:
				guy.gold -= PT_COST * 8;
				buy_stats( screen,guy,9 );
				return( AR_OK );
				break;

			case 5:
				guy.gold -= PT_COST * 12;
				buy_stats( screen,guy,14 );
				return( AR_OK );
				break;

			case 6:
				guy.gold -= 1000;
				return( AR_PASSAGE );
				break;

			case 7:
				return( AR_QUIT );
				break;

			}

		}


// spend points on stats
	void arena_t::buy_stats( Tscreen_t &screen, guy_t &guy, int pts ) {

		menu_t	menu;

		int	n;

		char	ch;


		// set up the menu
		n = 0;

		menu.set( 3, 41,5, 75,13, BD_OUT|_GFILLINTERIOR,".StpH\x1b " );
		menu.item[n++].set( 2,n, LO,HT,HI,NO, "Improve Skill",'S',I_ON );
		menu.item[n++].set( 2,n, LO,HT,HI,NO, "Improve Strength",'t',I_ON );
		menu.item[n++].set( 2,n, LO,HT,HI,NO, "Improve Health",'H',I_ON );

		n = 0;

		// spend points until done or escape
		do {

			//menu.item[0].state = pts >= 1;
			menu.item[1].state = pts >= 2;
			//menu.item[2].state = pts >= 1;


			// show guy & menu
			guy.show_stats( screen,10,5,BD_OUT );

			screen.box( menu.border,menu.x1,menu.y1-1,menu.x2,menu.y2 );
			sprintf( screen.buff,"Points left: %d",pts );
			screen.out_buff( menu.x1,menu.y1-1,14+7*16 );

			ch = menu.get( screen,n );

			switch ( n ) {

				case 0:
					guy.skill++;
					pts -= guy_cost.skill;
					break;

				case 1:
					guy.str++;
					pts -= guy_cost.str;
					break;

				case 2:
					guy.health++;
					pts -= guy_cost.health;
					break;

				}

			} while ( pts > 0 && ch != '\x1b' );


		guy.health0 = guy.health;
		guy.att0 = guy.att = guy.calc_att();
		}
