const secularReligionist = {
    name: "Secular Religionist",
    intro: "Do you hold the One True Faith while insisting you're simply being rational? This survey measures how much your thinking follows religious patterns—dressed in secular clothing. Don't worry, it's not a belief system. It's just obviously correct.",
    questionsPerCategory: 2,
    categories: [
        {
            name: "Ritual Behavior",
            positive: true,
            questions: [
                { text: "My morning routine has elements that feel spiritually necessary even if I'd never use that word.", positive: true },
                { text: "Certain consumption choices feel like moral hygiene.", positive: true },
                { text: "I have practices that provide meaning I'd be uncomfortable analyzing too closely.", positive: true },
                { text: "Skipping certain habits makes me feel vaguely polluted or off-balance.", positive: true },
                { text: "Some behaviors feel obligatory even when they have no measurable impact on anything.", positive: true },
                { text: "My habits are practical routines with no deeper significance.", positive: false },
                { text: "I don't attach moral weight to lifestyle choices.", positive: false },
                { text: "The concept of 'secular ritual' seems like a contradiction.", positive: false },
                { text: "I can skip any routine without guilt or unease.", positive: false },
                { text: "Rituals are comforting structures for people who need them.", positive: false }
            ]
        },
        {
            name: "Sacred Texts & Authorities",
            positive: true,
            questions: [
                { text: "There are thinkers whose work feels like it contains essential truths others have missed.", positive: true },
                { text: "I've given the same book to multiple people as something that might change their life.", positive: true },
                { text: "Some writers just get it in a way that's hard to explain to people who haven't read them.", positive: true },
                { text: "I trust certain sources so completely that questioning them feels like questioning reality.", positive: true },
                { text: "Disagreeing with certain ideas feels less like intellectual difference and more like denial.", positive: true },
                { text: "All thinkers are fallible humans whose ideas deserve skepticism.", positive: false },
                { text: "No book has ever felt revelatory to me.", positive: false },
                { text: "I'm instinctively wary of anyone with devoted intellectual followers.", positive: false },
                { text: "Expertise deserves respect, not deference.", positive: false },
                { text: "The concept of 'essential reading' seems cultish.", positive: false }
            ]
        },
        {
            name: "Heresy & Purity Testing",
            positive: true,
            questions: [
                { text: "Some opinions aren't just wrong—they reveal something troubling about the person holding them.", positive: true },
                { text: "You can tell a lot about someone's character from a single belief.", positive: true },
                { text: "There are positions that would make me lose respect for someone's judgment entirely.", positive: true },
                { text: "Certain views are so harmful that giving them a platform is itself a form of complicity.", positive: true },
                { text: "I've ended or limited relationships based on someone's ideological positions.", positive: true },
                { text: "Good, thoughtful people can hold views I find repugnant.", positive: false },
                { text: "Opinions and character should be judged separately.", positive: false },
                { text: "I maintain close friendships across major ideological divides.", positive: false },
                { text: "The impulse to treat wrong beliefs as moral failures is itself suspect.", positive: false },
                { text: "Calling ideas 'dangerous' is usually an excuse to avoid engaging with them.", positive: false }
            ]
        },
        {
            name: "Eschatology",
            positive: true,
            questions: [
                { text: "We are living through a uniquely pivotal moment in human history.", positive: true },
                { text: "Current trajectories lead to either transcendence or catastrophe within decades.", positive: true },
                { text: "The decisions made by people alive today will determine humanity's entire future.", positive: true },
                { text: "Certain threats are genuinely existential in a way previous generations never faced.", positive: true },
                { text: "We might be among the last people who can prevent disaster—or achieve something unprecedented.", positive: true },
                { text: "Every generation believes they're living at a crucial turning point. They're usually wrong.", positive: false },
                { text: "Predictions of imminent utopia or apocalypse have a dismal track record.", positive: false },
                { text: "The future will probably be boringly continuous with the present.", positive: false },
                { text: "Claims about existential stakes usually serve someone's fundraising or politics.", positive: false },
                { text: "History suggests humanity muddles through without decisive turning points.", positive: false }
            ]
        },
        {
            name: "Proselytizing",
            positive: true,
            questions: [
                { text: "If people truly understood what I understand, they would agree with me.", positive: true },
                { text: "I feel a responsibility to help others see things more clearly.", positive: true },
                { text: "Some ideas are important enough that spreading them is a moral obligation.", positive: true },
                { text: "I get frustrated when intelligent people can't see what seems obvious.", positive: true },
                { text: "I share content hoping to shift how people think about important issues.", positive: true },
                { text: "People should arrive at their own beliefs without my intervention.", positive: false },
                { text: "The urge to enlighten others is usually about the enlightener's ego.", positive: false },
                { text: "I don't feel compelled to share my worldview with anyone.", positive: false },
                { text: "Attempts to change minds usually just entrench disagreement.", positive: false },
                { text: "I keep my important beliefs private unless specifically asked.", positive: false }
            ]
        },
        {
            name: "Moral Certainty",
            positive: true,
            questions: [
                { text: "On the issues that matter most, I know I'm right.", positive: true },
                { text: "Some moral questions have clear answers that all reasonable people must accept.", positive: true },
                { text: "My core values are conclusions, not hypotheses still under review.", positive: true },
                { text: "People who claim uncertainty on obvious ethical issues are being evasive or cowardly.", positive: true },
                { text: "I can't imagine evidence that would change my position on certain moral questions.", positive: true },
                { text: "I hold even my strongest moral views tentatively, knowing I might be wrong.", positive: false },
                { text: "Genuine moral confidence is usually a failure of imagination.", positive: false },
                { text: "I've fundamentally changed my ethical beliefs as an adult.", positive: false },
                { text: "The hardest moral questions have no clear right answer.", positive: false },
                { text: "Strong moral conviction in others makes me instinctively suspicious.", positive: false }
            ]
        },
        {
            name: "In-Group & Out-Group",
            positive: true,
            questions: [
                { text: "There's a 'we' who understand things that 'they' simply don't.", positive: true },
                { text: "I feel genuine kinship with people who share my worldview.", positive: true },
                { text: "I can usually tell within minutes whether someone is 'one of us.'", positive: true },
                { text: "Some intellectual communities are epistemically trustworthy and others fundamentally aren't.", positive: true },
                { text: "Ideologically aligned spaces feel like home in a way mixed company doesn't.", positive: true },
                { text: "I don't identify meaningfully with any ideological community.", positive: false },
                { text: "In-group/out-group thinking is a bias to overcome, not a perception to trust.", positive: false },
                { text: "I'm genuinely at ease across the ideological spectrum.", positive: false },
                { text: "Feeling tribal about ideas seems like a warning sign, not a virtue.", positive: false },
                { text: "Communities organized around shared beliefs make me uncomfortable.", positive: false }
            ]
        }
    ]
};
