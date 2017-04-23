import sympy

R = sympy.Rational

A = sympy.Matrix([
    [-4,  0,   3,        1, 0, 0,       1],
    [ 3, -3,   3,  R(9, 2), 0, 0,       0],
    [ 0,  2,   4, R(11, 2), 0, 0, R(9, 2)],
    [-3, -3,   0,       -5, 1, 0,       0],
    [ 0,  0, -10,      -10, 0, 1,       0],
])
print(repr(A))
print(A.rref())
