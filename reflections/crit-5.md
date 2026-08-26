# Crit 5 reflection

## What was the breakthrough that moved the work forward?

Learning that I can use `/clear` to manage context. Long sessions build up a
lot of back-and-forth, and not all of it is still useful to the agent later —
knowing I can reset that context at the right moment, instead of letting it
grow forever, kept the agent focused instead of dragging around stale history
from earlier fixes that had nothing to do with the current problem.

## What did this work change about who I want to be as a software developer?

I learned not to rely on language alone when describing a bug. The clearest
example was the "door frame" issue: I described what I was seeing in words,
the agent fixed the thing I *named*, and it turned out that wasn't actually
the thing causing the problem — the same-looking obstruction showed up again
somewhere a door frame had never even existed. Words alone let the agent latch
onto the wrong object even when it sounded like a reasonable match. That
changed how I want to report problems going forward: instead of just
describing something in text, I want to hand the agent video, screenshots, and
other concrete files so it can see exactly what I'm pointing at, rather than
guessing from a description and possibly fixing the wrong thing.
