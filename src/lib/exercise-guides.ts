/**
 * How to perform each movement in the shared library: one short paragraph per
 * exercise, shown as a disclosure on the Exercises page.
 *
 * Keyed by lower-cased exercise name rather than by id, because the library
 * lives in Postgres and its ids are generated per environment. `getExerciseGuide`
 * is the only reader; a name with no entry (any custom exercise, for instance)
 * simply renders without a guide rather than an empty one.
 *
 * Each entry follows the same shape: set up, execute, and the one cue that
 * matters most. Kept to a few sentences on purpose, this is a reminder at the
 * rack, not a coaching manual.
 */

const GUIDES: Record<string, string> = {
  // ── Chest ───────────────────────────────────────────────────────────────
  "barbell bench press":
    "Lie back with your eyes under the bar, feet planted, and pull your shoulder blades down and together so your upper back stays tight against the bench. Unrack, lower the bar under control to the lower half of your chest with your elbows around 45–75° from your torso, then press back over your shoulders. Keep the blades pinned throughout: the bench does the supporting, not your shoulders.",
  "incline barbell press":
    "Set the bench to 30–45° and take the same tight, blades-back setup as a flat press. Lower the bar to your upper chest just below the collarbone, then press back up and slightly back over your shoulders. The steeper the incline the more front delt takes over, so 30° keeps the work on your upper chest.",
  "incline dumbbell press":
    "On a 30–45° bench, start with the dumbbells at the outside of your upper chest, wrists stacked over your elbows. Press up and slightly inward until the bells are over your shoulders without clanging them together, then lower under control until you feel a stretch across your chest. Dumbbells punish sloppy shoulders: keep your blades pulled down into the bench.",
  "decline barbell press":
    "Lock your legs into the pads on a 15–30° decline and set your blades back as you would on a flat press. Lower the bar to your lower chest, keeping your elbows tucked a touch closer than on flat, and press back up. The shortened range makes it feel heavy fast, so add weight more conservatively than you would on flat bench.",
  "machine chest press":
    "Set the seat so the handles sit at mid-chest height and your wrists stay in line with your elbows. Press out until your arms are almost locked, then return under control until you feel a stretch, letting the pad support your back the whole way. The fixed path means you can push closer to failure safely: use that instead of adding a heave.",
  "smith machine bench press":
    "Set the bench so the bar path lands on your lower chest, then take the usual tight upper back and unrack with a twist of the hooks. Lower under control and press back up, letting the fixed path let you focus purely on driving hard. Because the bar can't drift, don't grind reps against the safeties: set the stops where you can bail.",
  "dumbbell fly":
    "Lie flat with the dumbbells above your chest and a soft, fixed bend in your elbows. Open your arms in a wide arc until you feel a deep stretch across the chest, then bring them back along the same arc, thinking about squeezing your chest rather than pressing. Keep the elbow angle constant: the moment it opens and closes, it becomes a bad press.",
  "cable fly":
    "Set both pulleys at chest height or above, take a staggered stance and lean slightly into the movement with a soft bend in your elbows. Bring the handles together in front of your chest in a hugging arc, pause briefly, then let them travel back until you feel a stretch. Cables keep tension on the chest at the top, which is exactly where dumbbells lose it.",
  "pec deck":
    "Set the seat so the handles sit at chest height with your upper arms roughly parallel to the floor. Bring the pads together with your chest, pause where the squeeze is strongest, then return under control to a stretch. Keep your back on the pad: rocking forward turns it into a shoulder movement.",
  "push-up":
    "Set your hands slightly wider than your shoulders with your body in one line from ears to heels, ribs down and glutes tight. Lower until your chest is just off the floor with your elbows angled back around 45°, then press away and push the floor apart. If sets run past 20 reps, elevate your feet or add weight rather than chasing volume.",
  "dumbbell bench press":
    "Lie flat with the dumbbells at the outside of your chest, blades pulled down and together. Press up and slightly inward until they're over your shoulders, then lower under control until you feel a stretch across your chest. Dumbbells let each side work independently, so match the depth on both rather than chasing the stronger arm.",
  "decline dumbbell press":
    "Lock your legs into the pads on a 15–30° decline and start with the bells at the outside of your lower chest. Press up and slightly inward, then lower under control. Getting heavy dumbbells into position on a decline is the risky part: have someone hand them to you, or kick them up one at a time.",
  "dumbbell floor press":
    "Lie on the floor with the dumbbells at your chest and your knees bent. Press up until your arms are almost locked, then lower until your upper arms touch the floor and pause for a beat. The floor caps the range before the shoulder gets stretched, which is why it's the pressing variation to reach for when your shoulders are cranky.",
  "incline cable fly":
    "Set an incline bench between two low pulleys and take a handle in each hand with a soft, fixed elbow. Bring the handles up and together over your upper chest in a hugging arc, pause, then let them travel back into a stretch. Cables hold tension at the top of the arc, which is where the dumbbell version goes weightless.",
  "diamond push-up":
    "Set your hands together under your chest so your thumbs and index fingers form a triangle, body in one line from ears to heels. Lower with your elbows tracking close to your sides until your chest touches your hands, then press away. It's a triceps push-up: if your elbows flare out, you've turned it back into a chest one.",
  "chest dip":
    "Support yourself on the bars with a slight forward lean and your shoulders pulled down away from your ears. Lower under control until your upper arms are roughly parallel to the floor, elbows travelling back and slightly out, then press back up without locking hard at the top. The forward lean is what makes it a chest movement: stay upright and it becomes a triceps one.",

  // ── Back ────────────────────────────────────────────────────────────────
  deadlift:
    "Stand with the bar over mid-foot, hinge down and grip just outside your shins, then drop your hips until your shoulders sit slightly ahead of the bar and your back is flat. Take the slack out of the bar, then push the floor away and stand tall, keeping the bar dragging up your legs. If your hips shoot up first, the weight is too heavy for the brace you set.",
  "sumo deadlift":
    "Take a wide stance with toes turned out and grip inside your knees, then drop your hips, lift your chest and open your knees out over your feet. Push the floor apart as you stand, keeping the bar tight to your legs and your back flat. Sumo rewards patience off the floor: pull the slack out fully before you commit.",
  "trap bar deadlift":
    "Stand in the centre of the trap bar, hinge down and take the handles with a tall chest and flat back. Push through the floor and stand up, keeping the bar path straight down through your mid-foot, then lower under control. The neutral handles are kinder to the lower back than a straight bar, which makes it a good main pull on heavy weeks.",
  "rack pull":
    "Set the pins just below or just above your knees, take your normal deadlift grip and pull your chest tall with the bar against your legs. Drive your hips through to lockout, squeezing your glutes and upper back, then lower under control back to the pins. It's an overload movement: heavier than a floor pull, but only worth it with the same flat back.",
  "pendlay row":
    "Hinge to roughly parallel with a flat back and the bar resting on the floor under your shoulders. Row explosively into your lower ribs, pull your elbows past your torso, then return the bar all the way to the floor and reset each rep. The dead stop is the point: no bouncing, no rising torso.",
  "barbell row":
    "Hinge to about 45°, hold the bar with a shoulder-width overhand grip and set your back flat with the bar hanging under your shoulders. Row to your lower ribs by driving your elbows back and squeezing your shoulder blades together, then lower under control. Let the bar drift toward your chest and you'll turn a back movement into a shrug.",
  "dumbbell bent-over row":
    "Hinge forward to about 45° with a flat back and a dumbbell in each hand, arms hanging straight down. Row both bells toward your hips, elbows tracking close to your sides, and squeeze your shoulder blades at the top before lowering to a full stretch. Keep your torso still: if it rises with the weight, the back has stopped doing the work.",
  "single-arm dumbbell row":
    "Brace a hand and a knee on a bench with your back flat and parallel to the floor, dumbbell hanging at arm's length. Row it toward your hip, driving your elbow past your torso, then lower to a full stretch and let your shoulder blade travel forward. Rotating your torso to finish the rep is momentum, not range.",
  "chest-supported row":
    "Set the pad so your chest is supported and your arms hang free with a full stretch at the bottom. Row the handles toward your lower ribs, driving your elbows back and squeezing your shoulder blades, then return all the way out. With your chest locked in place there's nothing to cheat with, so pick a weight you can pause at the top.",
  "t-bar row":
    "Straddle the bar, hinge to roughly 45° with a flat back, and take the handles with your arms hanging straight. Row into your stomach with your elbows close to your sides, squeeze at the top, then lower to a full stretch. Keep the hinge fixed: the torso should not rise to help the last few reps.",
  "seated cable row":
    "Sit tall with a soft bend in your knees and let the handle pull your shoulder blades forward at the start of each rep. Row to your stomach by driving your elbows back and squeezing your blades together, then return under control to that same stretch. Leaning back and forth turns it into a hip movement: keep your torso still.",
  "inverted row":
    "Set a bar at waist height, hang underneath with straight arms and your body in one line from head to heels. Pull your chest to the bar by driving your elbows back and squeezing your blades, then lower under control. Walk your feet further out to make it harder, or elevate them for more; sagging hips are the sign to regress.",
  "machine row":
    "Set the chest pad and seat so your arms reach full extension without your shoulders rolling forward off the pad. Row the handles to your ribs, driving your elbows back and squeezing your shoulder blades, then return all the way out. The pad removes the lower back from the equation, so this is where to push hard on a heavy pull day.",
  "meadows row":
    "Wedge a barbell into a landmine, stand side-on in a staggered stance and grip the sleeve end with the far hand. Hinge over with a flat back, let the bar pull your shoulder into a deep stretch, then row it to your hip. The angle punishes twisting: keep your hips square and let your torso stay still.",
  "lat pulldown":
    "Set the thigh pads so you can't rise off the seat, take a grip a little wider than your shoulders and lean back slightly. Pull the bar to your upper chest by driving your elbows down and back, then let it rise all the way until you feel a stretch through your lats. It's an arm-path movement, not a hand one: think elbows into your back pockets.",
  "weighted pull-up":
    "Hang from the bar with a shoulder-width overhand grip, belt or dumbbell loaded, shoulders pulled down out of your ears. Pull your chest toward the bar by driving your elbows down, pause at the top, then lower to a full hang under control. Add weight only when you own a clean full range, half reps with a plate build nothing.",
  "pull-up":
    "Hang from the bar with an overhand grip a little wider than your shoulders and start by pulling your shoulders down away from your ears. Drive your elbows down and back until your chin clears the bar, then lower under control to a dead hang. Swinging your legs to get up is a rep you didn't earn: use a band if you need one.",
  "chin-up":
    "Take an underhand, shoulder-width grip and hang with your shoulders pulled down. Pull until your chin is over the bar, keeping your elbows tight to your sides, then lower to a full hang. The supinated grip pulls the biceps in hard, which is why it's the better choice on an arm-focused day.",
  "lat pullover":
    "Lie across or along a bench holding one dumbbell over your chest with a slight bend in your elbows. Lower it back over your head until you feel a deep stretch through your lats and ribs, then pull it back over your chest with your lats rather than your arms. Keep your ribs down: arching to gain range is your lower back, not your lats.",
  "dumbbell pullover":
    "Lie along a bench holding a single dumbbell over your chest, elbows slightly bent and locked at that angle. Take it back over your head under control until you feel the stretch, then bring it back over your chest. Breathe in on the way back and out as you pull: it opens the ribcage and makes the stretch worth having.",
  "straight-arm pulldown":
    "Stand a step back from a high pulley, hinge slightly at the hips and hold the bar with almost straight arms. Push the bar down to your thighs in an arc using your lats, pause, then let it rise until you feel the stretch overhead. Bend and extend your elbows and it becomes a triceps pushdown.",

  // ── Shoulders ───────────────────────────────────────────────────────────
  "overhead press":
    "Stand with the bar on your front delts, hands just outside your shoulders, glutes and abs braced hard. Tilt your head back an inch, press the bar past your face, then push your head back through so it finishes over your mid-foot. If your lower back arches to get the weight up, the brace failed before the shoulders did.",
  "seated dumbbell shoulder press":
    "Sit with your back on an upright pad, dumbbells at ear height, wrists stacked over elbows. Press up until your arms are almost locked without banging the bells together, then lower under control back to ear height. Seated takes your legs out of it: no bouncing the weight off your thighs.",
  "machine shoulder press":
    "Set the seat so the handles sit at roughly shoulder height and your wrists stay stacked over your elbows. Press up until your arms are nearly locked, then lower under control until your upper arms are about level with your shoulders. The fixed path makes it the safest place to push a shoulder press close to failure, so pick a weight you can control on the way down.",
  "arnold press":
    "Start seated with the dumbbells in front of your shoulders, palms facing you. Rotate your palms out as you press overhead, then reverse the rotation exactly on the way down. The rotation is the point: it takes the front delt through more range, so keep it slow rather than flicking through it.",
  "landmine press":
    "Wedge a barbell into a landmine, hold the sleeve end at shoulder height and brace with your ribs down. Press up and slightly forward until your arm is straight, then lower under control. The arc sits between a bench press and an overhead press, which makes it the pressing option when full overhead range bothers your shoulder.",
  "dumbbell lateral raise":
    "Stand tall with the dumbbells at your sides, a soft bend in your elbows and shoulders down. Raise your arms out to roughly shoulder height, leading with your elbows, then lower slowly under control. This is a small-muscle movement: if you need momentum to start it, halve the weight and double the reps.",
  "cable lateral raise":
    "Stand side-on to a low pulley and take the handle in the outside hand with a soft elbow. Raise the arm out to shoulder height against the cable, pause, then lower slowly. The cable keeps tension at the bottom where dumbbells go slack, which is exactly why it belongs on a side-delt-focused day.",
  "machine lateral raise":
    "Set the seat so the pads sit against your outer upper arms with your shoulders level. Push out and up to roughly shoulder height, pause, then lower slowly under control. The machine takes the swing out entirely, so treat the top of each rep as a pause rather than a turnaround.",
  "leaning cable lateral raise":
    "Grip an upright with one hand and lean away from a low pulley so your working arm hangs across your body. Raise it out to shoulder height against the cable, then lower slowly. Leaning away is the whole point: it loads the side delt in the stretched bottom position dumbbells can't reach.",
  "plate lateral raise":
    "Hold a small plate in each hand with a soft bend in your elbows and your shoulders down. Raise out to roughly shoulder height, lead with your elbows, then lower slowly. Plates make the load awkward at the top, so go lighter than your dumbbell raise weight and keep it strict.",
  "dumbbell front raise":
    "Hold the dumbbells in front of your thighs with a soft bend in your elbows and your ribs down. Raise them to shoulder height in a controlled arc, then lower slowly. Don't swing through the bottom: the front delt already gets plenty of work from pressing, so this one is about quality.",
  "cable front raise":
    "Stand facing away from a low pulley with the handle in front of your thigh and a soft bend in your elbow. Raise your arm to shoulder height in a controlled arc, then lower against the cable. Keep your ribs down: leaning back to finish the rep hands the work to your lower back.",
  "plate front raise":
    "Hold a plate at three and nine o'clock with your arms hanging in front of your thighs. Raise it to around eye height with a soft elbow, pause, then lower slowly. It's a front delt movement, so keep the weight modest and the torso still.",
  "cable upright row":
    "Stand over a low pulley with a bar or rope, hands around shoulder-width. Pull up the front of your body leading with your elbows, stop when your upper arms reach roughly shoulder height, then lower under control. The cable pulls slightly forward, which keeps tension on the delts through the whole range.",
  "dumbbell upright row":
    "Hold the dumbbells in front of your thighs about shoulder-width apart. Pull them up the front of your body with your elbows leading, stopping when your upper arms reach shoulder height, then lower slowly. Dumbbells let your wrists find their own path, which is why they tend to feel better here than a straight bar.",
  "upright row":
    "Take a grip around shoulder-width, stand tall and pull the bar up the front of your body, leading with your elbows. Stop when your upper arms reach roughly shoulder height, then lower under control. Go too narrow or too high and it pinches the shoulder: wider and lower is the version worth doing.",
  "rear delt fly":
    "Hinge forward to roughly 45° (or lie chest-down on an incline bench) with light dumbbells hanging under your shoulders. Raise your arms out to the sides with a fixed soft elbow, squeezing your rear delts, then lower under control. Keep the weight light and the elbows behind your torso, this is where ego lifting shows up most.",
  "cable rear delt fly":
    "Set two pulleys at shoulder height and cross the cables, taking the left handle in your right hand and vice versa. Sweep your arms out and back with a soft, fixed elbow, squeezing your rear delts, then return under control. Think about pulling the handles apart, not back, or the traps take over.",
  "prone rear delt raise":
    "Lie chest-down on an incline bench with light dumbbells hanging straight below your shoulders. Raise your arms out to the sides with a fixed soft elbow until they're level with your torso, then lower under control. The bench kills all momentum, so this is the strictest rear delt option you have, expect small weights.",
  "reverse pec deck":
    "Sit chest-against the pad with the handles set at shoulder height and a soft bend in your elbows. Sweep your arms out and back, squeezing your rear delts, then return under control without letting the weights touch down. Think about pulling the handles apart rather than back, it keeps the traps out of it.",
  "face pull":
    "Set a rope at roughly face height, step back until the cable is taut and start with your arms extended. Pull the rope toward your face, splitting your hands apart and finishing with your knuckles beside your ears and elbows high. Rear delts and upper back do the work: if the weight drags your torso forward, drop it.",

  // ── Traps ───────────────────────────────────────────────────────────────
  "barbell shrug":
    "Hold the bar at arm's length in front of your thighs, shoulders relaxed down, chest tall. Shrug straight up toward your ears, pause at the top, then lower under control to a full stretch. Rolling your shoulders adds nothing but wear: straight up, straight down.",
  "cable shrug":
    "Stand facing a low pulley holding a bar or handles at arm's length, shoulders relaxed down. Shrug straight up toward your ears, hold the top for a beat, then lower into a full stretch. The cable keeps pulling at the bottom, so the stretched position stays loaded in a way a barbell can't manage.",
  "dumbbell shrug":
    "Stand tall with a dumbbell in each hand at your sides and your shoulders relaxed. Shrug straight up as high as you can, hold for a beat, then lower slowly until you feel the stretch. Dumbbells at your sides let the traps travel a little further than a bar in front of you.",

  "farmer's carry":
    "Pick up a heavy dumbbell or handle in each hand, stand tall with your ribs down and your shoulders back, then walk in a straight line with short, controlled steps. Don't let the load pull you into a lean or a shrug. It's loaded by distance or time rather than reps, so log it the same way every week or the numbers won't compare.",

  // ── Biceps ──────────────────────────────────────────────────────────────
  "barbell curl":
    "Stand tall with the bar at arm's length, hands about shoulder-width, elbows pinned to your sides. Curl to the top without letting your elbows drift forward, then lower under control to a full stretch. If your torso swings back to start the rep, the set finished a rep ago.",
  "ez-bar curl":
    "Take the angled grips on an EZ bar, elbows tight to your ribs, and curl without letting them travel forward. Lower slowly to a full stretch at the bottom. The bent bar takes strain off the wrists, which is why it's the better pick if straight-bar curls bother yours.",
  "dumbbell curl":
    "Stand or sit tall with a dumbbell in each hand, palms forward or rotating up as you go. Curl with your elbows fixed at your sides, squeeze at the top, then lower slowly all the way down. Alternating arms lets you keep the tempo honest when the set gets hard.",
  "incline dumbbell curl":
    "Set a bench to around 45–60° and lie back with your arms hanging straight down behind your torso. Curl without letting your elbows drift forward, then lower all the way back to that stretched position. The stretch at the bottom is the whole reason for this variation, so don't cut the range short.",
  "lean-forward cable curl":
    "Set a low pulley, take the handle and step forward so your arm hangs slightly behind your body with the cable taut. Curl up with a fixed elbow, then lower under control back into that stretch. Like the incline curl, it loads the long head where it's longest, expect to need less weight than a standing curl.",
  "cable curl":
    "Stand a step back from a low pulley with the bar at arm's length and your elbows at your sides. Curl up without letting your elbows travel, squeeze, then lower slowly against the cable. Constant tension is the advantage here: no resting at the bottom.",
  "cable rope hammer curl":
    "Attach a rope to a low pulley and hold it with a neutral grip, elbows at your sides. Curl up keeping your palms facing each other, squeeze, then lower against the cable. The neutral grip plus constant tension makes this the best of the hammer variations for the brachialis.",
  "preacher curl":
    "Set the pad so it sits under your armpits with your upper arms flat against it. Curl from a full stretch to just short of vertical, keeping your arms on the pad the whole way, then lower slowly. The bottom of a preacher curl is where biceps tear if you drop into it: lower under control every rep.",
  "machine preacher curl":
    "Set the seat so your upper arms lie flat on the pad with your armpits against the top edge. Curl from a full stretch to just short of vertical, then lower slowly all the way back. The machine keeps the load on through the bottom, which is exactly where it's easy to drop out of a free-weight preacher.",
  "concentration curl":
    "Sit on a bench, brace your working elbow against the inside of your thigh and let the dumbbell hang at full stretch. Curl up, squeeze hard at the top, then lower slowly. There is nowhere to hide in this one, so treat it as a finisher rather than a strength movement.",
  "hammer curl":
    "Hold the dumbbells with palms facing each other and your elbows at your sides. Curl straight up keeping the neutral grip, then lower under control. The neutral grip shifts work onto the brachialis and forearm, which is what actually adds width to the arm.",

  // ── Triceps ─────────────────────────────────────────────────────────────
  "close-grip bench press":
    "Take a grip roughly shoulder-width, blades pinned back, and unrack as you would for a bench press. Lower the bar to your lower chest with your elbows tucked close to your sides, then press back up. Going narrower than shoulder-width doesn't add triceps work, it just wrecks your wrists.",
  "skull crusher":
    "Lie back holding an EZ bar or dumbbells over your shoulders with your upper arms angled slightly back. Bend at the elbows to lower the weight toward your forehead or just behind your head, then extend back up without letting your upper arms drift. Keep them still: once they swing, it's a pullover.",
  "overhead cable extension":
    "Face away from a low or mid pulley with the rope overhead and your upper arms beside your ears. Extend your elbows until your arms are straight, then let the rope travel back down behind your head into a deep stretch. Overhead is where the long head gets loaded: keep your ribs down so your back doesn't arch to help.",
  "overhead dumbbell extension":
    "Sit or stand tall holding one dumbbell overhead with both hands, upper arms beside your ears. Lower it behind your head under control until you feel a deep stretch through the triceps, then extend back up. Elbows stay pointed forward, letting them flare turns the stretch into shoulder strain.",
  "jm press":
    "Take a close-grip bench setup, then lower the bar toward your upper chest and chin with your elbows staying forward, somewhere between a close-grip press and a skull crusher. Stop when your forearms are near your biceps, then press back up. It's a heavy triceps movement, so build up slowly and keep the bar path tight.",
  "rope pushdown":
    "Stand a step back from a high pulley with the rope in both hands and your elbows pinned to your sides. Extend down and spread the rope apart at the bottom, then let it rise until your forearms are past parallel. Keep your elbows still: every inch they travel forward is work handed to your lats.",
  "triceps pushdown":
    "Set a bar at a high pulley, elbows tight to your ribs, torso upright with a slight forward lean. Push down until your arms are locked, pause, then let the bar rise under control. Leaning your bodyweight over the bar turns it into a press: keep the movement at the elbow.",
  "bench dip":
    "Sit on the edge of a bench, hands beside your hips, and slide forward so your weight is on your arms with your legs out in front. Lower until your upper arms are roughly parallel to the floor, then press back up. If your shoulders complain at the bottom, cut the depth rather than pushing through it.",

  // ── Quads ───────────────────────────────────────────────────────────────
  "barbell back squat":
    "Set the bar on your upper back, brace hard, and step out into a stance a touch wider than your shoulders with toes slightly out. Sit down between your hips, keeping your knees tracking over your toes, to at least parallel, then drive back up through your mid-foot. Brace before you descend, not on the way up.",
  "front squat":
    "Rack the bar across your front delts with your elbows high and your chest tall. Sit straight down keeping your torso as upright as you can, then drive back up without letting your elbows drop. The moment your elbows fall, the bar rolls forward, which is why upper back tightness matters more here than leg strength.",
  "smith machine squat":
    "Set the bar on your upper back and place your feet slightly in front of your hips so the fixed path suits your knees. Sit down to at least parallel, then drive back up through your mid-foot. The fixed bar means balance isn't the limit, so it's a good place to push closer to failure than you would free.",
  "hack squat":
    "Set your feet mid-platform about shoulder-width with your back and hips flat against the pad. Descend under control to at least parallel, keeping your knees tracking over your toes, then drive back up without locking hard at the top. Feet lower on the platform means more quad, higher means more glute.",
  "leg press":
    "Sit with your back and hips flat against the pad and your feet mid-platform, shoulder-width. Lower under control until your knees reach roughly 90° without your lower back rounding off the pad, then press back through your whole foot. Never lock the knees hard at the top: keep a slight bend and the tension on the quads.",
  "goblet squat":
    "Hold a dumbbell or kettlebell against your chest with your elbows tucked in. Sit straight down between your hips to full depth, keeping your chest tall, then stand back up. The front load makes it self-correcting: if you tip forward you'll feel it immediately, which is why it's the best squat to learn depth with.",
  "bulgarian split squat":
    "Set your rear foot on a bench and your front foot far enough forward that your front shin stays near vertical at the bottom. Lower until your rear knee is just off the floor, then drive up through your front heel. Balance is the limiting factor at first: hold light dumbbells and add load once the pattern is smooth.",
  "dumbbell forward lunge":
    "Stand tall with dumbbells at your sides, step forward and lower until both knees are around 90°. Push back through the front heel to return to the start, then alternate. Keep your torso upright, leaning forward shifts the work to the glutes and puts your front knee under more strain.",
  "walking lunge":
    "With dumbbells at your sides, step forward into a lunge until both knees are around 90°, then drive through the front heel and step directly into the next rep. Keep your torso tall and your steps long enough that your front shin stays near vertical. Count reps per leg, not total steps.",
  "lateral lunge":
    "Stand tall, take a wide step directly out to the side and sit back into that hip, keeping the trailing leg straight and both feet flat. Push off the bent leg to return to the start. It's the one lunge that loads the adductors, so expect to feel it on the inside of the thigh.",
  "curtsy lunge":
    "From standing, step one leg back and across behind the other, then lower until your front thigh is near parallel. Drive back up through the front heel. The crossover angle biases the glute medius, so keep the load light enough that your knee doesn't cave inward.",
  "dumbbell step-up":
    "Set a box or bench around knee height, plant one whole foot on it and drive through that heel to stand tall. Lower under control back to the floor rather than dropping. Pushing off the trailing foot is the cheat here: the working leg should do all of it.",
  "sumo squat":
    "Take a wide stance with toes turned out around 45° and hold a dumbbell between your legs. Sit straight down between your hips, keeping your knees pushed out over your toes, then drive back up. The wide stance pulls the adductors and glutes in far more than a conventional squat.",
  "nordic hamstring curl":
    "Kneel on a pad with your ankles anchored, body straight from knees to shoulders. Lower yourself forward as slowly as you can under hamstring control, catch with your hands, then push back just enough to restart. It's an eccentric movement: two or three honest reps beat ten you've fallen through.",
  "glute-ham raise":
    "Set your feet against the plate and your thighs on the pad of a GHD, body straight. Lower your torso under control until you feel a deep hamstring stretch, then pull yourself back up with your hamstrings rather than snapping at the hips. If you can't come back up, add a band or push off lightly with your hands.",
  "leg extension":
    "Set the pad just above your ankles and line the machine's pivot up with your knee. Extend until your legs are straight, squeeze for a beat, then lower under control. It's an isolation movement: full lockout with a pause beats a heavier, half-range swing every time.",

  // ── Hamstrings & glutes ─────────────────────────────────────────────────
  "romanian deadlift":
    "Start standing with the bar at your thighs, knees softly bent and locked at that angle. Push your hips back and let the bar travel down your legs until you feel a strong hamstring stretch, then drive your hips forward to stand. Range comes from your hamstrings, not your lower back: stop where the stretch stops, not where the floor is.",
  "dumbbell romanian deadlift":
    "Hold the dumbbells in front of your thighs, soft knees, chest tall. Hinge at the hips and let the bells run down your legs until your hamstrings say stop, then squeeze your glutes to stand back up. Keep the weights close, letting them drift forward turns it into a lower-back exercise.",
  "single-leg romanian deadlift":
    "Stand on one leg with a soft knee, holding a dumbbell in the opposite hand. Hinge forward letting the free leg travel back as a counterweight, keeping your hips square, then return to standing. Hips rotating open is the sign to lighten the load.",
  "good morning":
    "Set the bar on your upper back as you would for a squat, soften your knees and brace hard. Push your hips back and let your torso hinge toward parallel with a flat back, then drive your hips forward to stand. Start much lighter than feels necessary: this one punishes a loose brace immediately.",
  "lying leg curl":
    "Lie face down with the pad just above your heels and your hips flat on the bench. Curl your heels toward your glutes, squeeze, then lower under control without letting the weight drop. If your hips lift off the pad, the weight is doing the choosing.",
  "seated leg curl":
    "Set the thigh pad snug and the ankle pad just above your heels, sitting tall against the back rest. Curl your heels down and under, pause, then return under control. The seated version puts the hamstrings on stretch at the hip, which is why it tends to load them harder than lying.",
  "cable pull-through":
    "Face away from a low pulley with the rope between your legs, hands holding it at your hips. Hinge back with a flat back until you feel a hamstring stretch, then snap your hips forward and squeeze your glutes hard. Your arms are just hooks, if they're pulling, it's turned into a row.",
  "frog pump":
    "Lie on your back with the soles of your feet together and your knees fallen out to the sides, weight across your hips if you're loading it. Drive your hips up by squeezing your glutes, hold the top, then lower under control. The turned-out position takes the quads out of it, so run it for high reps.",
  "cable glute kickback":
    "Strap an ankle cuff to a low pulley, face the stack and hold on with a slight hinge forward. Drive the working heel back and up, squeezing the glute at the top, then return under control. Range comes from the hip, arching your lower back to get higher is your spine doing the work.",
  "glute bridge":
    "Lie on your back with your knees bent and heels close to your glutes, weight across your hips if you're loading it. Drive through your heels to lift your hips until your body is straight from knees to shoulders, squeeze hard, then lower. Ribs down and a hard glute squeeze at the top, not a lower-back arch.",
  "hip thrust":
    "Set your shoulder blades on a bench, roll the bar over your hips with a pad, and plant your feet so your shins are vertical at the top. Drive through your heels until your hips lock out level with your torso, squeeze, then lower under control. Tuck your chin and keep your ribs down: the movement finishes with the glutes, not the spine.",
  "hip abduction":
    "Sit tall in the machine with the pads against the outside of your knees. Push your knees apart, pause at the widest point, then return under control against the resistance. Leaning back changes which part of the glute works: pick a torso angle and hold it for the whole set.",
  "hip adduction":
    "Sit with the pads against the inside of your knees and your legs comfortably apart. Squeeze your knees together, hold for a beat, then let them open back to a stretch under control. Ease into the stretched position, the adductors do not enjoy being dropped into range.",
  "donkey kick":
    "On all fours with your back flat, drive one heel up and back until your thigh is in line with your torso, keeping the knee bent. Squeeze the glute at the top, then lower under control. Keep your hips square, arching your back to gain height is your spine, not your glute.",
  "fire hydrant":
    "On all fours with a flat back, lift one knee out to the side keeping the bend in it. Pause at the top, then lower under control. Your torso should stay level throughout, if it tips away it's tipping to make up for range you don't have.",

  // ── Calves ──────────────────────────────────────────────────────────────
  "standing calf raise":
    "Stand with the balls of your feet on the platform and your legs straight. Drop your heels for a deep stretch, then press all the way up onto your toes and pause at the top. Straight legs bias the gastrocnemius, and pausing at both ends is what makes calves grow, not bouncing.",
  "donkey calf raise":
    "Set the balls of your feet on a block and hinge forward at the hips, supporting your torso on a bench or the machine pad. Drop your heels into a deep stretch, then press all the way up onto your toes and hold. The bent-over position stretches the gastrocnemius more than a standing raise does, so lead with the stretch.",
  "seated calf raise":
    "Sit with the pad over your thighs and the balls of your feet on the platform. Lower your heels into a full stretch, then press up as high as you can and hold. Bent knees shift the work to the soleus, so treat this as the higher-rep partner to standing raises.",
  "leg press calf raise":
    "Sit in the leg press with the balls of your feet on the bottom edge of the platform and your knees almost straight. Press the platform away by extending your ankles, pause at full extension, then lower into a deep stretch. Keep the safeties engaged: this is one position you don't want to lose control of.",

  // ── Abs ─────────────────────────────────────────────────────────────────
  "hanging leg raise":
    "Hang from a bar with your shoulders pulled down and no swing. Raise your legs with straight knees until they're at least parallel to the floor, curling your pelvis up at the top, then lower under control. The pelvic tilt at the top is what makes it an ab movement rather than a hip flexor one.",
  "hanging knee raise":
    "Hang from a bar with your shoulders active, knees together. Raise your knees toward your chest, tilting your pelvis up at the top, then lower under control without swinging. It's the regression to the straight-leg version: earn a controlled full range here first.",
  "bicycle crunch":
    "Lie on your back with your hands light behind your head and your shoulder blades off the floor. Bring one knee in as you rotate the opposite shoulder toward it, then switch sides as the other leg extends. Rotate through your ribcage rather than yanking your head, and go slower than feels natural.",
  "plank":
    "Set your forearms under your shoulders, feet together, and hold a straight line from ears to heels with your ribs down and glutes tight. Breathe normally and keep your hips from sagging or piking up. It's a time hold rather than reps, so log the duration and add weight on your back once you pass a comfortable minute.",
  "cable crunch":
    "Kneel facing away from or below a high pulley with the rope beside your head and your hips fixed. Crunch by rounding your spine and bringing your elbows toward your thighs, squeeze, then return under control. The hips should not move, if you're hinging at them you're doing a pulldown with your abs along for the ride.",
  "weighted crunch":
    "Lie on your back with your knees bent, holding a plate or dumbbell against your chest. Curl your shoulder blades off the floor by rounding your upper back, pause at the top, then lower slowly. Range is short by design: chasing a full sit-up brings the hip flexors in.",
  "cable woodchopper":
    "Set a pulley high (or low, to chop upward), take the handle in both hands and stand side-on with your feet planted wide. Rotate through your torso and pull the handle diagonally across your body, letting your back foot pivot, then return under control. Arms stay long, the rotation comes from your midsection, not your shoulders.",
  "russian twist":
    "Sit with your knees bent and heels light on the floor, torso leaned back to around 45°, holding a weight at your chest. Rotate through your torso from side to side, letting your eyes follow the weight, and keep your chest tall. Rotate, don't just swing your arms across a still torso.",
  "decline sit-up":
    "Hook your feet on a decline bench and start lying back with a weight at your chest if you're loading it. Curl up by rounding your spine rather than yanking with your hip flexors, then lower under control. Set a shallow decline first: the steeper it gets, the more the hip flexors take over.",
  "ab wheel rollout":
    "Kneel with the wheel under your shoulders, ribs down and glutes tight. Roll out as far as you can while keeping your lower back flat, then pull yourself back with your abs. The moment your back arches you've gone past your range: shorten it rather than pushing further.",
  "renegade row":
    "Set up in a push-up position gripping two dumbbells, feet wide for stability. Row one dumbbell to your hip while keeping your hips square to the floor, lower it, then repeat on the other side. The point is the anti-rotation: if your hips twist with every row, go lighter.",

  // ── Forearms ────────────────────────────────────────────────────────────
  "reverse curl":
    "Hold the bar with an overhand, shoulder-width grip and your elbows at your sides. Curl up without letting your elbows drift, then lower under control. Expect to use far less weight than a normal curl, that's the point: it loads the brachialis and forearm extensors.",
  "wrist curl":
    "Rest your forearms on a bench or your thighs with your palms up and your wrists just past the edge. Let the weight roll down to your fingers, then curl it back up as high as you can and squeeze. High reps and a full roll-out beat heavy partials here.",
};

/**
 * Names are matched loosely: cased, hyphenated and punctuated variants all
 * collapse to the same key, so "Pull-Up", "Pull Up" and "pull up" resolve to
 * one guide. Built once at module load rather than per lookup.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_NORMALIZED_NAME = new Map(
  Object.entries(GUIDES).map(([name, guide]) => [normalize(name), guide]),
);

/** Look up the how-to for an exercise by its library name. */
export function getExerciseGuide(name: string): string | null {
  return BY_NORMALIZED_NAME.get(normalize(name)) ?? null;
}

/** How many movements carry a guide. */
export const GUIDE_COUNT = BY_NORMALIZED_NAME.size;
