# I wrote this on the train home from a trip for my little girl to play.
# I cleaned it up and added multiple players, because why not

import sys
import random

print('The point of this game is to be the player who')
print('can get closest to a number without going over.')
print('')
print('Each turn you can type "r" to roll a dice')
print('Careful, if you go over the number you lose a point!')
print('You can also type "s" to stop')
print('You might not win, but you won''t lose a point')
print('- If you go over, you lose ONE POINT!')
print('- If you win, you get ONE POINT!')
print('- If you get the number exactly, you get FIVE POINTS!')
print('')

player = ['Girl', 'Jenny LOL!', 'Unicorn', 'Fairy']
score = [0 for _ in player]

MAX = 12


def play_character(i):
    rolls = []
    while sum(rolls) < MAX - 4:
        rolls.append(random.randint(1, 6))
    print('{} rolled {} for {}'.format(player[i], ', '.join(map(str, rolls)), sum(rolls)))
    count = sum(rolls)
    if count == MAX:
        print('... {} got {}! Score 5 points!'.format(player[i], MAX))
        score[i] += 5
    elif count > MAX:
        print('... {} went over! Lose a point!'.format(player[i]))
        score[i] -= 1
        count = -1
    return count


def play_holly():
    count = 0
    while count < MAX:
        print('You are trying to get to {}. Do you want to r)oll or s)top?'
              .format(MAX))
        play = sys.stdin.readline()
        if play.startswith('r'):
            r = random.randint(1, 6)
            count = count + r
            print('You rolled {}. Your count is {}.'.format(r, count))
        else:
            break
    if count == MAX:
        print('... Perfect! You get FIVE POINTS!')
        score[0] += 5
    elif count > MAX:
        print('... You went over! Lose a point!')
        score[0] -= 1
        count = -1
    else:
        print('You stopped! Your count is {}'.format(count))
    return count


def show_scores():
    print('Score:\n-----')
    for j in range(len(player)):
        print('{} {}'.format(player[j], score[j]))
    print('-----')


def determine_order():
    toplay = range(len(player))
    random.shuffle(toplay)
    print('The order is {}'.format(", ".join([player[i] for i in toplay])))
    return toplay


def play_turn(toplay):
    count = [0 for _ in player]

    for i in toplay:
        count[i] = play_holly() if i == 0 else play_character(i)
        if count[i] == MAX:
            break

    best = max(count)
    for i in range(len(player)):
        if count[i] == MAX:
            print('{} won!'.format(player[i]))
            break
        elif count[i] > MAX or count[i] < 0:
            pass
        elif count[i] >= best:
            print('{} won with {}!'.format(player[i], count[i]))
            score[i] += 1
            break

    show_scores()


while max(score) < 11:
    t = determine_order()
    play_turn(t)