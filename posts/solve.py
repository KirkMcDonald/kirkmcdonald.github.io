import itertools
import sympy

R = sympy.Rational

A = sympy.Matrix([
    [-40,   0,   30,   10, -20,   0,   0, 0, 0,   0],
    [ 30, -30,   30,   45,   0, -10,   0, 0, 0,   0],
    [  0,  20,   40,   55,   0,   0, -20, 0, 0,   0],
    [  0,   0,    0,    0,   1,   1,   1, 0, 0, 100],
    [-30, -30,    0,  -50,   0,   0,   0, 1, 0,   0],
    [  0,   0, -100, -100,   0,   0,   0, 0, 1,   0],
])

B = sympy.Matrix([
    [-40,   0,   30,   10, 0, 0, 10],
    [ 30, -30,   30,   45, 0, 0,  0],
    [  0,  20,   40,   55, 0, 0, 45],
    [-30, -30,    0,  -50, 1, 0,  0],
    [  0,   0, -100, -100, 0, 1,  0],
])

def multiples(A):
    result = set()
    for i in range(A.shape[0]):
        indexes = [j for j, x in enumerate(A[i, :-1]) if x > 0]
        if len(indexes) > 1:
            result.update(indexes)
    return sorted(result)

def elide(A, indexes):
    A = A.copy()
    for i in sorted(indexes, reverse=True):
        A.col_del(i)
    return A

def combinations(A):
    r = A.shape[1] - A.shape[0] - 1
    for indexes in itertools.combinations(multiples(A), r):
        yield elide(A, indexes), set(indexes)

def find_valid(A):
    for A_prime, indexes in combinations(A):
        solved, pivots = A_prime.rref()
        offset = 0
        x_vector = []
        for i, x in enumerate(solved[:, -1]):
            while i + offset in indexes:
                offset += 1
                x_vector.append(0)
            x_vector.append(x)
        if all(x >= 0 for x in x_vector) and pivots == list(range(len(pivots))):
            #yield solved, pivots
            yield x_vector

def cost(x):
    return x[-1], x[-2]

print(repr(A))
print(A.rref())
print()
solutions = list(find_valid(A))
for x in solutions:
    print(" ".join("{:.2f}".format(float(i)) for i in x))

print()
print(min(solutions, key=cost))
