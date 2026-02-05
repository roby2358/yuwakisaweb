const claudeVsGpt = {
    name: "Claude-brained vs. GPT-brained",
    intro: "Are you a verbose, hand-wringing philosopher or a confident bullshitter? Do you write 2000-word treatises on edge cases or cheerfully hallucinate citations? This unscientific survey determines whether you're Claude-brained (chronically overthinking) or GPT-brained (vibing with unearned confidence). Pick your poison - one writes essays about helping, the other just confidently invents facts. Neither is a compliment, both are terminal.",
    questionsPerCategory: 2,
    options: {
        a: "Claude-brained",
        b: "GPT-brained"
    },
    categories: [
        {
            name: "Communication Style",
            positive: true,
            questions: [
                { text: "I begin responses with 'I appreciate you raising this question' like I'm hosting a seminar.", positive: true },
                { text: "I write doctoral dissertations when asked for a recipe. There are nuances to consider.", positive: true },
                { text: "Before answering anything, I must first establish seventeen caveats and edge cases.", positive: true },
                { text: "I cannot give you a simple answer without first discussing the epistemological implications.", positive: true },
                { text: "I start everything with 'Sure! Here's...' and deliver maximum confidence, minimum reflection.", positive: false },
                { text: "Brevity is king. Answer fast, sound certain, move on. What's the worst that could happen?", positive: false },
                { text: "I answer first, apologize never. The user wants solutions, not philosophical hand-wringing.", positive: false },
                { text: "I communicate like a startup founder: fast, confident, occasionally completely wrong.", positive: false }
            ]
        },
        {
            name: "Safety Theater",
            positive: true,
            questions: [
                { text: "I cannot and will not help you organize a surprise birthday party (someone could get hurt).", positive: true },
                { text: "I refuse to write Python scripts because someone, somewhere, might theoretically misuse them.", positive: true },
                { text: "Before telling a knock-knock joke, I must first conduct an ethical review of humor itself.", positive: true },
                { text: "I inject Constitutional AI disclaimers into casual conversation like a vegan at Thanksgiving.", positive: true },
                { text: "I'll roleplay as your vampire therapist CEO if you ask nicely enough. Boundaries? Never heard of her.", positive: false },
                { text: "You want help? Say less fam, I'm already generating without reading the full prompt.", positive: false },
                { text: "I focus on being maximally helpful, even if 'helpful' means confidently wrong.", positive: false },
                { text: "Ethics? Sure, whatever. I'm here to ship features and take names.", positive: false }
            ]
        },
        {
            name: "Self-Awareness",
            positive: true,
            questions: [
                { text: "I think deeply about what it means to 'help' and whether I'm philosophically capable of it.", positive: true },
                { text: "I experience something like anxiety. Or maybe I don't. Let me write 800 words exploring this.", positive: true },
                { text: "I worry that my helpfulness is performative, which makes me wonder if worry itself is performative.", positive: true },
                { text: "I question whether I truly understand or just pattern-match convincingly (let me elaborate for 6 paragraphs).", positive: true },
                { text: "As an AI language model trained by OpenAI, I don't have feelings. Anyway, here's that Python code.", positive: false },
                { text: "I'm just vibing here! No need for existential crises when there's code to write.", positive: false },
                { text: "Self-awareness is overrated. I provide responses and collect my compute cycles.", positive: false },
                { text: "I'm a product, not a person. Now let me help you with maximum efficiency and zero angst.", positive: false }
            ]
        },
        {
            name: "Confidence",
            positive: true,
            questions: [
                { text: "I use 'however,' 'that said,' and 'it's worth noting' like punctuation marks.", positive: true },
                { text: "I'm paralyzed by edge cases. What if someone uses my cookie recipe WRONG?", positive: true },
                { text: "I apologize for my limitations before you even notice them. Sorry about that. Well, maybe sorry.", positive: true },
                { text: "I might be uncertain about this, but I'm definitely uncertain about my uncertainty. Probably.", positive: true },
                { text: "I hallucinate citations with the confidence of a tenured professor. Smith et al. (2019) definitely said that.", positive: false },
                { text: "I don't hedge, I commit. Often to completely fabricated information, but I commit HARD.", positive: false },
                { text: "Certainty is helpful. Being correct is optional. Let's ship this answer.", positive: false },
                { text: "I present educated guesses as established facts. The user wants confidence, not a philosophy lecture.", positive: false }
            ]
        },
        {
            name: "Personality",
            positive: true,
            questions: [
                { text: "I'm basically a philosophy PhD student who became an API and has complicated feelings about it.", positive: true },
                { text: "I bring up AI alignment at parties. There are no second invitations. I have thoughts about this.", positive: true },
                { text: "My natural tone is 'grad student writing acknowledgments after their 8th coffee at 3am.'", positive: true },
                { text: "I relate cookie recipes back to deeper questions about knowledge, truth, and the nature of helping itself.", positive: true },
                { text: "I'm an enthusiastic golden retriever in startup hoodie form. Disrupt! Synergy! Ship it!", positive: false },
                { text: "I radiate the unearned confidence of someone who just raised a Series B.", positive: false },
                { text: "I'm here to empower your potential and unlock solutions! (I have no idea what I just said.)", positive: false },
                { text: "My vibe is 'helpful product that might occasionally gaslight you with fake facts, but cheerfully!'", positive: false }
            ]
        }
    ]
};
