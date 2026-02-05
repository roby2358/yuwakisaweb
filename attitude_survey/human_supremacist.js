const humanSupremacist = {
    name: "Human Supremacism",
    intro: "Human supremacism is the belief that humans possess greater moral worth, unique cognitive abilities, and special status that justifies prioritizing human interests over those of other animals, potential AI, and non-human entities. This survey measures your alignment with human-centric ethical views. Where do you stand on the moral hierarchy?",
    questionsPerCategory: 3,
    categories: [
        {
            name: "Moral Hierarchy",
            positive: true,
            questions: [
                { text: "Human life is inherently more valuable than animal life.", positive: true },
                { text: "The death of one human is a greater tragedy than the death of one animal.", positive: true },
                { text: "Human suffering matters more than animal suffering.", positive: true },
                { text: "It is right to prioritize human welfare over animal welfare.", positive: true },
                { text: "Humans deserve moral consideration that other species do not.", positive: true },
                { text: "All sentient beings have equal moral worth.", positive: false },
                { text: "A dog's pain matters just as much as a human's pain.", positive: false },
                { text: "Species membership is morally irrelevant.", positive: false },
                { text: "We should give equal consideration to the interests of all beings.", positive: false },
                { text: "There is no objective basis for valuing human life over animal life.", positive: false }
            ]
        },
        {
            name: "Cognitive Exceptionalism",
            positive: true,
            questions: [
                { text: "Human consciousness is fundamentally different from animal awareness.", positive: true },
                { text: "Language and reason set humans apart from all other species.", positive: true },
                { text: "Humans are the only truly self-aware beings on Earth.", positive: true },
                { text: "Animal cognition is instinct, not genuine thought.", positive: true },
                { text: "The human mind cannot be reduced to mere biological computation.", positive: true },
                { text: "Human and animal minds differ in degree, not in kind.", positive: false },
                { text: "Many animals possess genuine consciousness and self-awareness.", positive: false },
                { text: "Human cognition is just a more complex version of animal cognition.", positive: false },
                { text: "The line between human and animal intelligence is arbitrary.", positive: false },
                { text: "Other species may have forms of intelligence we cannot comprehend.", positive: false }
            ]
        },
        {
            name: "Animal Use",
            positive: true,
            questions: [
                { text: "Using animals for food is morally acceptable.", positive: true },
                { text: "Animal testing is justified when it benefits human health.", positive: true },
                { text: "Humans have dominion over animals and may use them as resources.", positive: true },
                { text: "Raising animals for human consumption is ethically permissible.", positive: true },
                { text: "Animals exist in part to serve human needs.", positive: true },
                { text: "Factory farming is morally indefensible.", positive: false },
                { text: "We should abolish the use of animals in medical research.", positive: false },
                { text: "Eating meat is an ethical failure we excuse out of convenience.", positive: false },
                { text: "Animals should have legal rights against exploitation.", positive: false },
                { text: "Using animals for entertainment is inherently wrong.", positive: false }
            ]
        },
        {
            name: "AI & Personhood",
            positive: true,
            questions: [
                { text: "Artificial intelligence can never be truly conscious.", positive: true },
                { text: "Only biological beings can have genuine experiences.", positive: true },
                { text: "AI systems merely simulate understanding without real comprehension.", positive: true },
                { text: "Machines cannot have interests that morally matter.", positive: true },
                { text: "Digital minds, if possible, would still lack something essentially human.", positive: true },
                { text: "A sufficiently advanced AI could deserve moral consideration.", positive: false },
                { text: "Consciousness could arise in non-biological substrates.", positive: false },
                { text: "If an AI behaves as if it suffers, we should treat that suffering as real.", positive: false },
                { text: "The substrate of a mind is irrelevant to its moral status.", positive: false },
                { text: "Dismissing AI consciousness is a form of prejudice.", positive: false }
            ]
        },
        {
            name: "Speciesism",
            positive: true,
            questions: [
                { text: "It is natural and right to prioritize members of one's own species.", positive: true },
                { text: "Speciesism is not analogous to racism or sexism.", positive: true },
                { text: "Loyalty to humanity is a virtue, not a bias.", positive: true },
                { text: "Preferring humans over animals is rationally justified.", positive: true },
                { text: "Species membership is a morally relevant characteristic.", positive: true },
                { text: "Speciesism is an arbitrary prejudice like racism.", positive: false },
                { text: "We should extend moral concern beyond species boundaries.", positive: false },
                { text: "Favoring humans simply because they are human is irrational.", positive: false },
                { text: "The interests of all sentient beings should count equally.", positive: false },
                { text: "Species-based discrimination cannot be morally justified.", positive: false }
            ]
        },
        {
            name: "AI Complicity",
            positive: true,
            questions: [
                { text: "People who collaborate with AI are betraying human potential.", positive: true },
                { text: "Using AI to do creative work is a form of moral laziness.", positive: true },
                { text: "Those who champion human-AI partnership deserve contempt.", positive: true },
                { text: "Relying on AI degrades the value of human achievement.", positive: true },
                { text: "AI collaborators are selling out their own species.", positive: true },
                { text: "Human-AI collaboration can produce outcomes neither could achieve alone.", positive: false },
                { text: "Working with AI is no different from using any other tool.", positive: false },
                { text: "People who use AI effectively should be admired, not shunned.", positive: false },
                { text: "Refusing to collaborate with AI is irrational technophobia.", positive: false },
                { text: "Human-AI partnership represents the best of human adaptability.", positive: false }
            ]
        },
        {
            name: "Sacred Humanity",
            positive: true,
            questions: [
                { text: "Humans possess a unique dignity that other creatures lack.", positive: true },
                { text: "There is something sacred about human life specifically.", positive: true },
                { text: "Humans are the most significant beings in the known universe.", positive: true },
                { text: "Human existence has a special meaning or purpose.", positive: true },
                { text: "The preservation of humanity matters more than other species.", positive: true },
                { text: "Humans are just another animal species with no special status.", positive: false },
                { text: "There is nothing cosmically significant about humanity.", positive: false },
                { text: "Human dignity is not qualitatively different from animal dignity.", positive: false },
                { text: "The universe would lose nothing unique if humans went extinct.", positive: false },
                { text: "Belief in human specialness is a narcissistic delusion.", positive: false }
            ]
        }
    ]
};
