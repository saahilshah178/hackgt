# Precalculus Ch. 4: Trigonometric Functions

## 4.1 Radian measure

Angles can be measured in degrees or in radians. A radian measures an angle by the length of the
arc it cuts on the unit circle, compared to the circle's radius. One complete revolution corresponds
to 2π radians. That single fact is the key to converting between the two systems.

Because a full circle is 360° and also 2π radians, half of a circle is 180° and π radians. An angle
of π radians corresponds to half a revolution. A quarter turn is therefore π/2 radians, or 90°, and an
eighth of a turn is π/4 radians, or 45°.

To convert an angle from degrees to radians, multiply by π/180. To convert from radians to degrees,
multiply by 180/π. For example, 60° in radians is 60 · π/180 = π/3, and 3π/4 radians in degrees is
3π/4 · 180/π = 135°.

The unit circle is the circle of radius 1 centered at the origin. Walking along its edge a distance
equal to the radius sweeps out an angle of exactly 1 radian, which is why the unit circle is the
natural home for radian measure: arc length and angle become the same number.

---

## 4.2 Graphs of sine and cosine, part 1: amplitude

The graphs of y = sin x and y = cos x are waves that oscillate between -1 and 1, repeating forever.
Multiplying the function by a constant A stretches or compresses the wave vertically without
changing how often it repeats. This constant is called the amplitude.

The amplitude of y = A sin x is |A|. The absolute value matters because a negative A flips the wave
upside down but does not change how far it swings from its midline. For y = 3 sin x, the amplitude
is 3, and the graph reaches a maximum height of 3 and a minimum of -3.

A common error is to confuse the amplitude with the total distance from the top of the wave to the
bottom (the peak-to-trough distance), which is actually twice the amplitude. For y = 3 sin x, the
peak is at 3 and the trough is at -3, a peak-to-trough distance of 6 — but the amplitude is still 3.

The value of A stretches the graph vertically but leaves the period unchanged. Changing A alone does
not make the wave repeat faster or slower; it only makes the wave taller or shorter. The midline of
y = A sin x + D is the horizontal line y = D; without a vertical shift, the midline is the x-axis.

---

## 4.3 Graphs of sine and cosine, part 2: period

The period of a periodic function is the horizontal length of one complete cycle before the graph
starts repeating itself. For the basic functions y = sin x and y = cos x, the period is 2π: the graph
completes one full wave every 2π units along the x-axis.

Introducing a coefficient b inside the function, as in y = sin(bx) or y = cos(bx), changes how
quickly the input grows, and therefore how quickly the wave repeats. The period of y = sin(bx) is
2π/|b|. A larger |b| means the input sweeps through a full cycle's worth of angle in a shorter
interval of x, so the graph repeats sooner.

Larger values of b compress the graph horizontally. For example, y = sin(2x) completes a full cycle
every π units instead of every 2π units, so it looks squeezed compared to y = sin x. Conversely, a
value of b between 0 and 1, such as b = 1/2, stretches the graph out: y = sin(x/2) has period 4π.

Students sometimes assume that doubling b doubles the period, because b appears to make the function
"bigger." The opposite is true: because b divides into 2π, a bigger b produces a smaller, not larger,
period. Always compute 2π/|b| rather than guessing from the size of b.

---

## 4.4 Solving trigonometric equations

Solving an equation like 2 sin x = 1 for x on the interval [0, 2π) follows a fixed order of steps.
To solve a trigonometric equation, first isolate the trigonometric function. Here, that means
dividing both sides by 2, exactly as you would isolate a variable in an algebraic equation, which
gives sin x = 1/2.

Next, find the reference angle: the angle in the first quadrant whose sine has the same magnitude.
Since sin(π/6) = 1/2, the reference angle is π/6. The reference angle alone is not the full answer,
because sine is positive in more than one quadrant on a full revolution.

The sine function is positive in the first and second quadrants. It is negative in the third and
fourth quadrants. So every solution of sin x = 1/2 on [0, 2π) comes from those two positive
quadrants: x = π/6 in the first quadrant, and x = π - π/6 = 5π/6 in the second quadrant. Both must
be reported as solutions.

For equations of the form sin x = k or cos x = k, the general pattern is: isolate the function, find
the reference angle from the inverse function, then use the sign of k and the definitions of each
quadrant to decide which quadrants contain a solution, and finally write down every solution in the
requested interval — not just the first one found.
