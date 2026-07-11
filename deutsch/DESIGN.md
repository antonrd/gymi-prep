# Design Document: German Connector Dataset for Zurich Gymi Entrance Exam Preparation

## 1. Objective

Create a structured dataset of German connectors suitable for a student preparing for the **Gymnasium entrance exam after 6th grade in the Canton of Zurich**.

The dataset should serve two purposes:

1. **Learning resource**

   * Teach the meaning and usage of important German connectors.
   * Explain grammar rules and common mistakes.
   * Provide varied examples.

2. **Exercise-generation resource**

   * Generate fill-in-the-gap exercises.
   * Accept multiple valid answers where appropriate.
   * Support quizzes, flashcards, and automated practice.

The goal is not to create a complete list of all German conjunctions, but a focused, exam-relevant collection.

---

# 2. Scope

## Included

Include connectors that are:

* common in modern German,
* relevant for primary school and Gymi preparation,
* frequently encountered in reading and writing,
* useful for improving sentence structure.

Target size:

**Approximately 45–50 connectors/expressions**

Expected distribution:

* 25–30 conjunctions
* 15–20 conjunctive adverbs and connector expressions

---

## Excluded

Exclude:

* archaic connectors,
* literary-only forms,
* rare academic expressions,
* words unlikely to occur in a Zurich Gymi entrance context.

The dataset should prioritize usefulness over completeness.

---

# 3. Connector Categories

The dataset should be grouped by grammatical function.

---

## A. Coordinating conjunctions

Characteristics:

* connect two main clauses,
* normal word order remains unchanged.

Examples:

* und
* oder
* aber
* sondern
* denn

---

## B. Subordinating conjunctions

Characteristics:

* introduce subordinate clauses,
* verb moves to the end.

Examples:

* weil
* dass
* wenn
* als
* obwohl
* bevor
* nachdem
* während
* bis
* seitdem
* sobald
* solange
* falls
* damit

---

## C. Paired conjunctions

Expressions consisting of two fixed parts.

Examples:

* entweder ... oder
* weder ... noch
* sowohl ... als auch
* nicht nur ... sondern auch
* zwar ... aber

Special handling:

* Store as one expression.
* Store the number of required gaps.
* Examples must contain multiple blanks.

Example:

Sentence:

> Ich esse ______ Fleisch ______ Fisch.

Answer:

> weder ... noch

---

## D. Conjunctive adverbs

Included because they are frequently confused with conjunctions.

Examples:

* deshalb
* deswegen
* darum
* daher
* trotzdem
* außerdem
* allerdings

Important:

These follow different word-order rules.

Example:

Correct:

> Es regnet. Deshalb bleiben wir zu Hause.

Incorrect:

> Es regnet. Deshalb wir bleiben zu Hause.

---

# 4. Dataset Structure

The dataset should contain two levels:

## Level 1: Connector information

Information about the word/expression.

## Level 2: Example exercises

Five carefully designed examples for each connector.

This separation allows:

* vocabulary learning,
* exercise generation,
* answer validation.

---

# 5. Connector-Level Fields

Each connector/expression should have:

| Field                  | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| ID                     | Unique identifier                                          |
| German connector       | Word/expression                                            |
| English meaning        | Short translation                                          |
| Type                   | Conjunction / paired conjunction / conjunctive adverb      |
| Category               | Reason, contrast, time, condition, addition, purpose, etc. |
| Word order rule        | Main grammatical rule                                      |
| CEFR estimate          | Approximate level                                          |
| ZAP importance         | ★★★★★ to ★★★                                               |
| ZAP relevance          | Yes/No                                                     |
| Gap count              | Number of blanks required                                  |
| Commonly confused with | Similar connectors                                         |
| Notes                  | Additional explanations                                    |

---

# 6. Importance Rating

Use:

★★★★★ Essential

* Must know for Gymi preparation.

★★★★ Important

* Strongly recommended.

★★★ Recognition level

* Useful but less likely to be directly tested.

The final dataset should mainly contain ★★★★★ and ★★★★ connectors.

---

# 7. Example-Level Fields

Each connector should contain exactly **five example sentences**.

Each example should include:

| Field                 | Description                           |
| --------------------- | ------------------------------------- |
| Full sentence         | Correct complete sentence             |
| Gap sentence          | Version with connector removed        |
| Correct answer        | Expected connector                    |
| Accepted alternatives | Other valid answers                   |
| Alternative notes     | When alternatives are acceptable      |
| Context               | School, family, hobbies, travel, etc. |
| Difficulty            | Easy / Medium / Challenging           |
| Tested skill          | Grammar concept being practiced       |

---

# 8. Example Sentence Requirements

Each connector must have five examples with deliberate variation.

## Context variety

Examples should cover:

* school and learning,
* family,
* friends,
* hobbies and sports,
* nature,
* travel,
* everyday situations.

---

## Grammar variety

Examples should vary:

### Sentence position

Examples should include:

* connector in the middle,
* connector at the beginning,
* longer sentences.

---

### Subjects

Use variety:

* ich
* du
* er/sie
* wir
* sie

---

### Sentence complexity

Include:

* simple sentences,
* realistic school-level sentences,
* occasional more challenging constructions.

---

# 9. Accepted Answers and Alternatives

A major requirement:

Each gap exercise must define which answers are accepted.

Not every connector has true synonyms, so alternatives must be evaluated carefully.

---

## Alternative categories

### Exact alternatives

Same meaning and same grammar.

Example:

Sentence:

> Es regnet. ______ bleiben wir zu Hause.

Accepted:

* deshalb
* deswegen
* darum
* daher

---

### Context-dependent alternatives

Possible only in certain contexts.

Example:

> ______ ich Zeit habe, lese ich.

Accepted:

* wenn

Not:

* als

because the meaning is different.

---

### Grammar alternatives

Same meaning but different sentence structure.

Example:

> Ich bleibe zu Hause, weil ich krank bin.

Possible:

* weil
* da

Not:

* denn

because "denn" requires a main clause structure.

---

# 10. Quality Requirements

All examples must be:

* grammatically correct,
* natural modern German,
* suitable for 11–12-year-old students,
* appropriate for Swiss school context,
* understandable without advanced vocabulary.

Avoid:

* unnatural textbook sentences,
* rare vocabulary,
* adult professional topics,
* ambiguous sentences with too many possible answers.

---

# 11. Exercise Generation Rules

The dataset should support:

## Fill-in-the-gap exercises

Example:

Original:

> Ich bleibe zu Hause, weil ich krank bin.

Generated:

> Ich bleibe zu Hause, ______ ich krank bin.

Accepted:

* weil
* da

---

## Multiple-choice exercises

Generate distractors from:

* commonly confused connectors,
* wrong word-order connectors,
* semantically similar but incorrect options.

---

## Error correction exercises

Example:

Incorrect:

> Weil ich bin müde, gehe ich schlafen.

Student fixes:

> Weil ich müde bin, gehe ich schlafen.

---

# 12. Output Format

Primary format:

CSV

Suitable for:

* Excel,
* Google Sheets,
* Anki,
* automated exercise generation.

Possible additional formats:

* Markdown study guide,
* printable worksheet,
* quiz format,
* flashcards.

---

# 13. Expected Size

Final dataset:

* 45–50 connectors/expressions
* 5 examples each
* approximately 225–250 exercises

The result should function as a complete connector-learning system for a Zurich Gymi candidate.
