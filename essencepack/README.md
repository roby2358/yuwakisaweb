algorithm for searching an n-dimensional space for local maxima based on
a scoring mechanism for vectors in that space:

Initialize an empty list of points.
Generate a random vector with n dimensions, evaluate its score, and add
it to the list of points.
Begin the search process by repeating the following steps:
a. Generate a new random vector and evaluate its score.
b. For each vector in the list of points, perform the following:
i. Calculate the weighted average of the new random vector and the current
vector in the list, using their scores as weights:
- Compute the sum of the scores and handle the case where the sum is 0.
- Calculate the weights for both the new random vector and the current vector
- in the list.
- Compute the weighted average for each dimension.
  ii. Add the resulting vector to the list of points.
  c. Add the new random vector to the list of points.
  d. Sort the list of points by score and remove the lowest-scored vectors
- to keep a fixed number of points (n).
  Continue the search process until the highest-scored vector in the list
- meets the desired criteria or the target score.
  The algorithm generates random vectors in the search space, combines them
- with the existing points using a weighted average, and maintains a fixed-size
- list of the highest-scored vectors. The search process is repeated until a
- satisfactory solution is found.

Stopping criteria
- target score
- maximum number of iterations
- minimum change in the best solution between iterations
- number of iterations with no change

Exploration
- Divide the space into a quadtree of hyper-rectangles, as many as you have
- space for
- Each time you generate a random number, choose the hyper-rectangle with
- the fewest sample points
- This distributes the exploration over the space