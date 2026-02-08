// Feedback: "a couple of these end up being real inside baseball. i love that
// it has two separate fedorovist questions though that rules"

const tescreal = {
    name: "TESCREAL",
    intro: "TESCREAL is the bundle of ideologies shaping Silicon Valley's vision of the future: Transhumanism, Extropianism, Singularitarianism, Cosmism, Rationalism, Effective Altruism, and Longtermism. How aligned are you with this techno-optimist worldview? Let's find out.",
    questionsPerCategory: 3,
    categories: [
        {
            name: "Transhumanism",
            positive: true,
            questions: [
                { text: "I would upload my consciousness to a computer if possible.", positive: true },
                { text: "Humans should use technology to overcome biological limitations.", positive: true },
                { text: "I would get a brain-computer interface implant.", positive: true },
                { text: "Aging is a disease that should be cured.", positive: true },
                { text: "I would replace healthy body parts with superior prosthetics.", positive: true },
                { text: "Genetic engineering of humans is a natural next step.", positive: true },
                { text: "The human body is already perfect as it is.", positive: false },
                { text: "There is something sacred about natural human limitations.", positive: false },
                { text: "Technology should heal, not enhance.", positive: false },
                { text: "Death gives life meaning.", positive: false }
            ]
        },
        {
            name: "Extropianism",
            positive: true,
            questions: [
                { text: "Boundless expansion is humanity's destiny.", positive: true },
                { text: "I am optimistic that technology will solve most problems.", positive: true },
                { text: "Entropy can be defeated through intelligence.", positive: true },
                { text: "Self-transformation is a moral imperative.", positive: true },
                { text: "There are no fundamental limits to progress.", positive: true },
                { text: "Spontaneous order is preferable to central planning.", positive: true },
                { text: "Some things are better left unchanged.", positive: false },
                { text: "Growth for its own sake is dangerous.", positive: false },
                { text: "We should accept natural limits gracefully.", positive: false },
                { text: "The universe tends toward disorder and we should accept that.", positive: false }
            ]
        },
        {
            name: "Singularitarianism",
            positive: true,
            questions: [
                { text: "Artificial general intelligence will be created within my lifetime.", positive: true },
                { text: "The technological singularity is inevitable.", positive: true },
                { text: "Machine intelligence will eventually surpass human intelligence.", positive: true },
                { text: "An intelligence explosion could transform civilization overnight.", positive: true },
                { text: "We should actively work to accelerate the development of superintelligence.", positive: true },
                { text: "The singularity will be the most important event in human history.", positive: true },
                { text: "Human-level AI is centuries away, if possible at all.", positive: false },
                { text: "Intelligence has fundamental limits that cannot be transcended.", positive: false },
                { text: "Predictions about superintelligence are more fiction than science.", positive: false },
                { text: "Singularity predictions are unfounded technological speculation.", positive: false }
            ]
        },
        {
            name: "Cosmism",
            positive: true,
            questions: [
                { text: "Humanity must become a multi-planetary species.", positive: true },
                { text: "Colonizing the galaxy is a moral obligation.", positive: true },
                { text: "We should resurrect the dead using future technology.", positive: true },
                { text: "Humans are the universe becoming conscious of itself.", positive: true },
                { text: "Space exploration should be our top priority.", positive: true },
                { text: "We have a duty to spread intelligence throughout the cosmos.", positive: true },
                { text: "Earth is humanity's only appropriate home.", positive: false },
                { text: "Space colonization is an escapist fantasy.", positive: false },
                { text: "We should fix Earth before looking to the stars.", positive: false },
                { text: "The dead should stay dead.", positive: false }
            ]
        },
        {
            name: "Rationalism",
            positive: true,
            questions: [
                { text: "Bayesian reasoning is the correct framework for all belief formation.", positive: true },
                { text: "Most people's opinions are worthless because they haven't thought carefully about their biases.", positive: true },
                { text: "I would take a pill that made me more rational, even if it changed my personality.", positive: true },
                { text: "The world would be better if more people studied decision theory.", positive: true },
                { text: "If your gut feeling contradicts the expected utility calculation, your gut is wrong.", positive: true },
                { text: "Assigning numerical probabilities to everyday beliefs is performative, not insightful.", positive: false },
                { text: "Formal decision-making frameworks are mostly useful in textbooks, not real life.", positive: false },
                { text: "Some important truths can only be understood through experience, not analysis.", positive: false },
                { text: "People who say 'I've updated on that' in conversation are mostly signaling membership, not practicing epistemology.", positive: false },
                { text: "Calling yourself a rationalist doesn't make you more rational than anyone else.", positive: false }
            ]
        },
        {
            name: "Effective Altruism",
            positive: true,
            questions: [
                { text: "Charity should be guided by rigorous impact measurement.", positive: true },
                { text: "I would work on whatever cause helps the most beings.", positive: true },
                { text: "Earning to give is a valid form of altruism.", positive: true },
                { text: "Helping strangers far away matters as much as helping neighbors.", positive: true },
                { text: "I calculate the cost-effectiveness of my donations.", positive: true },
                { text: "Impartiality is essential to doing good.", positive: true },
                { text: "Charity begins at home.", positive: false },
                { text: "The heart matters more than the spreadsheet.", positive: false },
                { text: "Local causes deserve priority over global ones.", positive: false },
                { text: "Helping is about the gesture, not the impact.", positive: false }
            ]
        },
        {
            name: "Longtermism",
            positive: true,
            questions: [
                { text: "Future people matter as much as present people.", positive: true },
                { text: "Reducing existential risk should be a global priority.", positive: true },
                { text: "A trillion future lives outweigh a thousand present ones.", positive: true },
                { text: "We are the ancestors of a vast cosmic civilization.", positive: true },
                { text: "Present sacrifices are justified by future flourishing.", positive: true },
                { text: "Humanity's long-term potential is almost incomprehensibly large.", positive: true },
                { text: "We cannot meaningfully plan beyond a few generations.", positive: false },
                { text: "The present is all that truly matters.", positive: false },
                { text: "Future people can take care of themselves.", positive: false },
                { text: "Speculating about the far future is pointless.", positive: false }
            ]
        }
    ]
};
