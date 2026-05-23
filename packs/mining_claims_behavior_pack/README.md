# Mining Claims Behavior Pack

## Overview
This pack adds **Mining Claims** using a **Waxed Copper Bulb** as the claim block.

Rules:
- a player cannot break blocks until they place a Mining Claim anchor
- a player cannot place normal blocks until they place a Mining Claim anchor
- after they own a Mining Claim, they can only break blocks **inside their own Mining Claim**
- after they own a Mining Claim, they can only place blocks **inside their own Mining Claim**
- placing a **Waxed Copper Bulb** anchor is always allowed through the mining-claim placement rule; claim creation/max/overlap checks happen afterwards
- normal block placement restrictions use **before-event prevention** with an **after-event fallback cleanup** if Bedrock still allows placement
- Mining Claims cannot overlap any other claim type stored in the shared claim registry
- breaking the Waxed Copper Bulb removes the Mining Claim

## Commands
- `/scriptevent mc:help`
- `/scriptevent mc:inspect`
- `/scriptevent mc:list`
- `/scriptevent mc:remove`
- `/scriptevent mc:bypass on`
- `/scriptevent mc:bypass off`

## Admin setup
- `/tag @s add pbz_admin`

Admin tag allows commands only. Actual bypass is only enabled with:
- `/scriptevent mc:bypass on`
