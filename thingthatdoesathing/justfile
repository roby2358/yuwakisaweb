# List available commands
default:
    @just --list

# Run every test: R-n rules, integration walkthroughs, coverage (pass -v for every check)
cc-test *flags:
    node test/run.js {{flags}}

# Tuning harness: the greedy builder bot plays N games on one board size (small, medium,
# large, huge) and prints how many reach the first milestone and the turn spread
cc-sim games size:
    node test/sim.js {{games}} {{size}} 1

# The same bot played on to the Nth milestone: turns to each milestone, big crates spawned (D-34)
cc-sim-to games size milestones:
    node test/sim.js {{games}} {{size}} {{milestones}}
