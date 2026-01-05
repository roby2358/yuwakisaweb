/**
 * Sample Problems - Pre-defined constraint problems for demonstration
 */

export const SAMPLE_MEETING_SCHEDULING = 'I need to schedule 3 meetings, each 1 hour long, between 9am and 5pm, with no overlaps. Meeting 1 requires Sue and Tom, but Tom is unavailable from 9am to 12pm. Meeting 2 requires Sue and Ben. Meeting 3 requires all three people (Sue, Tom, and Ben).';

export const SAMPLE_GRAPH_COLORING = 'I have 4 regions that need to be colored. Region 1 borders regions 2 and 3. Region 2 borders regions 1, 3, and 4. Region 3 borders regions 1, 2, and 4. Region 4 borders regions 2 and 3. No two adjacent regions can share the same color. Find a valid coloring using at most 3 colors.';

export const SAMPLE_MAGIC_SQUARE = 'Fill in the 4x4 magic square that starts with 1 in the top-left corner and ends with 16 in the bottom-right corner. Each row, column, and both diagonals must sum to the same value.';
