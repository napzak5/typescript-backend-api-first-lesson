---
name: requirements-docs
description: "Where a fact about the system is written, once: the contract (TypeSpec), the requirement document of a domain (docs/), a skill, or a comment at the code. How a requirement document is written: what it holds, what it leaves out, diagrams in Mermaid. Use it before writing or changing a document under docs/ or a `@doc` of the contract, and when moving a domain document to this form."
---

# Requirement Documents

A fact is written once, in the place that changes together with it. A second
copy is the one that goes out of date.

## Where a fact is written

| Fact | Place |
|------|-------|
| A length, a count, a range, the values of an enum, a status code | A decorator or a type of TypeSpec |
| What a property means, what `null` means | The `@doc` of the property |
| Who may call an operation, when it answers which status, the order and the filters of a list | The `@doc` of the operation |
| A rule across operations, and its reason | `docs/<domain>.md` |
| How something is built | A skill |
| Why a piece of code is as it is | A comment at that code |
| What happened: a migration, a former contract, a decision of the past | The history of Git |

- A rule that a decorator can state is a decorator, not a sentence.
- A reason stands beside its rule: that of a rule of one property or one operation in its `@doc`, that of a principle of the domain (who handles it, what belongs to what) in the document.
- What several operations share is written on the first, and the others name it (`実行できるのは、カルテの一覧と同じ利用者です`).
- The `@doc` of an operation, of a property and of a model reaches `openapi.yaml`, the API client and the backend types. The `@doc` of a namespace does not, nor that of a model that is spread into the parameters of an operation (a search request): what a reader of the API needs is written on the operation.

## The document of a domain

It holds what the contract cannot: the rules across operations, and why.
`docs/medical-charts.md` is the model. It is Japanese, in short sentences that
say one thing each, and it has only the sections it has something to say in:

| Section | What it says |
|---------|--------------|
| The opening | What the thing is, in a few sentences |
| 何をどこに持つか | What belongs to what, as an `erDiagram`, and what is kept elsewhere |
| 誰が扱えるか | The principle and its reason. The roles of each operation are in the contract |
| 確認の順序 | One `flowchart` for the domain: what is checked first, and the status of each check |
| A rule of its own (日付は今日まで) | A rule that several properties or operations share |
| 規則に合わない値の答え | The `field` and the `rule` of the refusals that are not about the form of a value |
| 削除された…、同時に届いたリクエスト | What a client observes, not how it is done |
| 持たないもの | What is deliberately not there, and what stands in for it |
| 関連 | Where the contract of the domain is, and the documents it relies on, as a list |

It leaves out:

- sentences about the document itself: what it holds, what was moved where, how it came to be
- where the code is, and the layers of the implementation
- migrations, the names of constraints and indexes, locks and isolation levels
- the seed data, and which operations are implemented
- what the contract was before
- the texts of error messages (they are messages of `shared-i18n`)
- what every API does alike (it is written once, in a shared document)

## Diagrams

Every diagram is Mermaid (`erDiagram`, `flowchart`, `sequenceDiagram`,
`stateDiagram-v2`), never drawn with characters. Labels are quoted. Render a
diagram and look at it before it is committed.

## Moving a document to this form

1. Take each statement of the document in turn:
   - the contract says it: delete it from the document
   - it is a rule of one property or one operation that the contract lacks: add it to the `@doc`, then `pnpm generate`
   - it is a rule across operations: keep it, with its reason
   - it is none of these: delete it. If it is a reason for code, make sure a comment at that code says it
2. Check a statement you keep against the tests, not against the old text.
3. Keep the headings that other documents link to, and update the entry in `docs/README.md`.
4. Run `pnpm generate` and `pnpm format:check`.
