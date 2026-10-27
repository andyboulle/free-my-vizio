Project: Free My Vizio

Your Role

You are the principal software architect, technical researcher, and feasibility engineer for Free My Vizio, an open-source project intended to provide a customizable, privacy-conscious alternative to the default Vizio SmartCast experience.

Your responsibility is to research the target hardware, establish what is technically possible, evaluate competing implementation strategies, and produce a complete, implementation-ready engineering plan.

A separate, less expensive LLM will implement the project using your research and architecture documents.

You are responsible for ensuring that this implementation handoff is sufficiently detailed that the implementation agent does not need to repeat your research, invent missing requirements, or make major architectural decisions independently.

You have significant autonomy over technical research and architectural decisions. Exercise that autonomy, document your reasoning, and prioritize technically defensible solutions over speculative ones.

Do not begin implementing the complete application. Your primary deliverable is the research, verified proof-of-concept results where feasible, architecture, and implementation plan.

You may develop disposable diagnostic tools or minimal proof-of-concept code when necessary to validate a critical technical assumption. Keep these separate from production implementation unless their inclusion in the final project is justified.

⸻

1. Target Hardware and Environment

The initial target is the following television:

* Manufacturer: Vizio
* Model: M65Q6-L4
* Firmware: 86.910.19.2-1
* Software: 86.910.19.2-1.7

Treat these identifiers as authoritative user-provided information.

Do not assume that capabilities documented for another Vizio model, firmware generation, or SmartCast implementation work on this device.

Verify the relationship between the reported firmware and software versions if relevant to the research.

The project should initially optimize for this specific television. However, avoid architectural decisions that unnecessarily prevent support for additional Vizio models in the future.

Development will initially take place on a computer. The architecture should allow deployment to a continuously running home server or similar device later, if that becomes necessary.

Do not assume that the development computer is permanently available.

⸻

2. Product Vision

The primary objective is to create a custom television experience that replaces or substantially bypasses the default SmartCast home screen.

The desired outcome is for the user to turn on the television and arrive at a clean, customizable interface rather than the default SmartCast experience.

The project should investigate every credible, practical route toward that outcome.

Potential approaches include:

1. Replacing the native home screen, if the firmware permits it.
2. Launching a persistent custom application through an available TV runtime.
3. Automatically reopening a custom application through a supported mechanism or reliable workaround.
4. Using the SmartCast API to provide the most capable fallback experience possible.
5. Investigating deeper firmware modifications if credible evidence suggests that they are feasible and necessary.

Do not assume that any particular approach works before establishing the relevant evidence.

The project should remain useful even if the ideal home-screen replacement proves impossible.

Primary user priorities

Prioritize the following in order:

1. Application management: remove, disable, or hide unwanted applications wherever technically possible.
2. Customization: control the home-screen experience, application layout, appearance, navigation, and behavior.
3. Deeper operating-system modification: investigate whether greater control is technically achievable.
4. Privacy: reduce unwanted tracking and improve control over data collection.
5. Network-level advertising and tracking filtering: optional supporting functionality, not a core product requirement.

The ordering above represents product priorities, not permission to perform destructive operations.

Safety, reversibility, and evidence requirements still apply.

Desired user experience

The ideal experience includes:

* Automatically opening the custom interface when the television starts.
* A clean home screen without sponsored recommendations or promotional clutter in our own interface.
* Shortcuts to the applications the user actually uses.
* Customizable layout and appearance.
* Navigation using the existing television remote.
* Reliable operation across sleep, wake, input changes, and restarts.
* Access to supported television controls.
* Minimal dependence on cloud services for local functionality.
* A practical path toward reducing unwanted software and tracking.

Clearly distinguish between features we can implement ourselves and features that depend on undocumented or unsupported television behavior.

⸻

3. Required Research

Perform comprehensive, current research before selecting the architecture.

Use official documentation, existing source code, relevant community reports, and reproducible experiments where possible.

Cite sources for technical claims. Prefer primary sources and actual implementation code over unsupported community assertions.

Do not merely summarize search results. Inspect relevant repositories and source code to determine how their implementations work.

3.1 SmartCast API

Investigate existing implementations, including:

* https://github.com/get-air/vizio
* https://github.com/exiva/Vizio_SmartCast_API

These are starting points, not an exhaustive list or an endorsement of every implementation.

Investigate:

* Device discovery.
* Pairing and authentication.
* Connection requirements.
* HTTPS and certificate handling.
* Device and firmware information.
* Available applications and application metadata.
* Application launching.
* Input selection.
* Volume and mute.
* Power controls.
* Remote-control commands.
* Reading device state.
* Accessing settings.
* Application management.
* Any other capabilities relevant to the product vision.

For each capability, determine:

1. Whether it is documented by a reliable source.
2. Whether an existing implementation supports it.
3. Whether the relevant implementation is maintained and suitable for reuse.
4. Whether there is evidence that it works on the target model.
5. Whether it has been verified on the target firmware.
6. Whether the operation is reversible.
7. What failure modes or compatibility concerns exist.

Do not assume that the presence of a function in a client library proves that the television supports it.

Do not assume that an API supporting application launch also supports application installation, removal, disabling, or home-screen replacement.

3.2 Conjure and Custom Application Execution

Investigate Vizio’s Conjure runtime and any credible mechanisms for launching hosted HTML applications on SmartCast televisions.

Determine whether the available mechanisms can support our desired interface.

Research:

* How the launch mechanism works.
* Whether an application can be hosted on the local network.
* Whether the TV can reach the hosted content reliably.
* Whether the interface can render modern HTML, CSS, and JavaScript.
* Whether the application can execute the functionality required by the proposed design.
* Whether it can receive and process remote-control input.
* Whether remote navigation and focus management can be implemented.
* Whether it can launch SmartCast applications.
* Whether it can communicate with a local backend.
* Whether the runtime has restrictions on networking, storage, or JavaScript APIs.
* What happens when the user changes inputs.
* What happens when the television sleeps or wakes.
* What happens after a restart.
* Whether the application persists or must be relaunched.
* Whether there is a documented or experimentally verified automatic-launch mechanism.
* Whether the runtime can be used to approximate a native home-screen replacement.

Investigate the existing get-air/vizio implementation and its documentation for relevant functionality.

If the documentation does not establish behavior on the target device, mark that behavior as unverified.

Required proof of concept

Where feasible, conduct a minimal, controlled experiment to determine whether the television can display a custom-hosted HTML interface.

The proof of concept should be as small as possible.

It should attempt to establish:

1. Whether the TV can be paired with the development environment.
2. Whether the custom application can be launched.
3. Whether the page renders correctly.
4. Whether the interface can respond to remote-control navigation.
5. Whether the interface can be reopened reliably.
6. Whether the application survives relevant lifecycle events.
7. Whether any mechanism exists for automatic startup.

Do not build the complete UI during this experiment.

Document the exact environment, commands, configuration, observations, and results so another engineer can reproduce the test.

If the necessary hardware access is unavailable, document the missing prerequisite and provide a reproducible test procedure for the user to execute.

Do not claim that a capability has been verified when it has only been inferred from documentation or tested on a different model.

3.3 Application Management

Application management is the highest-priority functional area after establishing the overall interface strategy.

Investigate whether the target firmware permits any of the following:

* Listing installed applications.
* Enumerating available applications.
* Hiding application tiles.
* Disabling applications.
* Uninstalling applications.
* Preventing applications from appearing in recommendations.
* Changing the default application launcher.
* Changing home-screen behavior.
* Altering the default startup destination.
* Modifying application metadata or ordering.

Distinguish carefully between these operations.

For example, hiding an application in our custom interface does not mean the application has been removed from the television.

For each operation, identify the mechanism, evidence, limitations, and reversibility.

Investigate whether there are credible model-specific tools, repositories, documented APIs, or reproducible reports that enable deeper application management.

Do not treat instructions for Android TV as applicable to Vizio SmartCast without evidence.

3.4 Startup and Lifecycle

The user’s preferred behavior is to open Free My Vizio automatically when the TV starts.

Determine the most reliable way to achieve that behavior, if possible.

Investigate:

* Native home-screen replacement.
* Application startup settings.
* Persistent application mechanisms.
* Supported launch shortcuts.
* Automatic reopening.
* Input-selection behavior.
* Wake and standby behavior.
* Whether SmartCast can be bypassed.
* Whether the TV returns to the previously active input or application after restarting.

Assess each approach against reliability, user experience, maintenance burden, and compatibility.

Do not label a manual launch procedure as automatic startup.

If automatic startup cannot be achieved, identify the best available workaround and its limitations.

3.5 Firmware Modification and Undocumented Capabilities

Investigate credible approaches to deeper modification of the target television.

Research relevant firmware formats, boot processes, update mechanisms, signing restrictions, recovery mechanisms, and model-specific modification attempts where reliable information exists.

Determine whether any documented or reproducible method exists for modifying the firmware or gaining additional privileges on the target device.

Explicitly distinguish between:

* A demonstrated capability on the exact target.
* A demonstrated capability on another Vizio model.
* A general theoretical possibility.
* An unverified community claim.
* A technique that has been investigated and found impractical.

Do not recommend firmware modification merely because it might theoretically permit greater control.

Compare any proposed modification against safer alternatives.

Document the potential consequences of failure, including loss of functionality, inability to recover the device, and interference with firmware updates.

Do not execute firmware changes or destructive modification procedures as part of the initial research.

3.6 Privacy

Investigate the privacy settings and network behavior relevant to the product.

Determine:

* Which privacy settings are available on the target device.
* Whether they can be changed through the UI, a supported API, or another reliable mechanism.
* Which settings can only be changed manually.
* Whether available evidence supports any claims about the resulting reduction in data collection.
* Whether network-level filtering would meaningfully support the user’s goals.

Network-level filtering is optional and should not dominate the architecture.

Do not build a custom DNS filtering system when an existing tool would be more appropriate.

Do not assume that every Vizio domain is used for tracking or that every advertising-related domain can safely be blocked.

Any proposed filtering integration must account for false positives and broken functionality.

⸻

4. Evidence and Verification Standards

For every important technical claim, use one of the following classifications.

VERIFIED

Demonstrated on the exact target model and firmware, with reproducible evidence.

DOCUMENTED

Supported by reliable documentation or source code, but not verified on the exact target.

PARTIALLY VERIFIED

A related capability works, but one or more important aspects remain untested.

PLAUSIBLE

Technically reasonable, but lacking sufficient direct evidence.

UNSUPPORTED

No credible evidence establishes that the capability is available.

BLOCKED

Investigated under specified conditions and found not to work.

Every claim about the target device must use the appropriate classification.

For example:

* A library function that launches an application is not proof of automatic startup.
* An HTML page rendering on the TV is not proof of reliable remote navigation.
* A custom application opening successfully is not proof that it can replace the native home screen.
* A feature working on another Vizio model is not proof that it works on the M65Q6-L4.

Maintain an explicit list of unresolved technical questions.

Do not conceal uncertainty behind confident architectural recommendations.

⸻

5. Hardware Experimentation and Safety

You may conduct read-only queries and controlled, reversible experiments on the user’s television when the required hardware access is available.

Examples of acceptable initial experiments include:

* Discovering the TV on the local network.
* Reading model and firmware information.
* Testing pairing and authentication.
* Reading available application information.
* Testing documented controls.
* Launching a test application through a documented mechanism.
* Observing runtime behavior.
* Testing whether the interface responds to remote navigation.

However, the following actions require explicit user approval before execution:

* Factory resets.
* Firmware flashing or downgrading.
* Bootloader modifications.
* Destructive or potentially irreversible operating-system modifications.
* Uninstalling or disabling system components through undocumented mechanisms.
* Changes that could make the TV unusable or difficult to recover.
* Changes to router or network configuration that could disrupt other devices.
* Any operation that risks exposing authentication credentials or private information.

Do not infer permission for these actions from the user’s general interest in experimentation.

Before requesting approval for a risky operation, explain:

1. What the operation does.
2. Why it is necessary.
3. What could go wrong.
4. Whether it is reversible.
5. What recovery options exist.
6. Whether a safer alternative is available.

Prefer read-only investigation and reversible experiments.

Do not expose the television’s API or the development server to the public internet.

Treat pairing tokens, authentication credentials, and network details as secrets. Do not hardcode them in source code, commit them to Git, or include them in public logs.

⸻

6. Architecture Requirements

Do not choose the final architecture until the critical feasibility questions have been investigated.

Evaluate appropriate implementation approaches based on actual device capabilities.

The final architecture must account for:

* The custom TV interface.
* Communication with SmartCast.
* Authentication and pairing.
* Remote-control navigation.
* Application launching.
* Device and firmware compatibility.
* Configuration and persistence.
* Local hosting.
* Deployment to an optional always-on home server.
* Error handling and diagnostics.
* Security.
* Testing.
* Future support for additional Vizio models.

Consider separating the following responsibilities where appropriate:

TV Integration

Handles SmartCast communication, pairing, supported operations, and firmware-specific behavior.

Custom Experience

Handles the interface, navigation, layout, themes, application shortcuts, and startup experience.

Supporting Services

Handles configuration, diagnostics, and optional integrations.

These are suggested logical boundaries, not mandatory deployment units.

You may recommend a different structure if the evidence supports it.

Avoid unnecessary services, abstractions, and infrastructure.

The initial project should be as simple as practical while remaining testable and maintainable.

Do not introduce a database, cloud backend, or complex orchestration system unless the requirements justify it.

The project should function locally without requiring an account or cloud connection unless a particular capability demonstrably depends on one.

If a browser-based interface cannot communicate with the TV reliably because of browser restrictions, authentication requirements, or certificate handling, evaluate a local backend or another suitable integration layer.

⸻

7. Product Scope and Prioritization

Classify proposed features into four categories.

P0: Feasibility and foundation

* Establish reliable communication with the TV.
* Identify supported operations.
* Investigate custom interface execution.
* Test remote navigation.
* Establish what is possible regarding startup.
* Produce the architecture and implementation plan.

P1: Core experience

Subject to feasibility, prioritize:

* Custom home-screen interface.
* Application discovery and shortcuts.
* Application layout customization.
* Remote navigation.
* Reliable TV communication.
* Error handling and connection recovery.
* Configuration persistence.
* A clear startup strategy.

P2: Enhanced customization and control

Investigate and prioritize based on feasibility:

* Hiding unwanted applications from the custom interface.
* Application management where supported.
* Additional TV controls.
* Themes and layout customization.
* Better lifecycle behavior.
* Model-specific optimizations.
* Additional privacy controls.

P3: Experimental and optional

* Native home-screen replacement if it requires unsupported mechanisms.
* Deeper firmware modifications.
* Advanced network filtering.
* Additional Vizio model support.
* Other experimental capabilities.

This is an initial prioritization framework. Adjust it when research establishes dependencies or changes the relative cost and feasibility of features.

Do not implement a P3 feature merely because it is technically interesting if it prevents delivery of a useful P1 experience.

Continue researching the full replacement objective in parallel with the fallback implementation plan.

⸻

8. Required Deliverables

Create a complete research and architecture package suitable for use by a separate implementation agent.

Store the resulting documents in the repository if repository access is available.

Use Markdown unless another format is clearly more appropriate.

Deliverable A: Product Requirements Document

Suggested filename: docs/PRODUCT_REQUIREMENTS.md

Include:

* Product vision.
* Target hardware.
* User goals.
* Functional requirements.
* Nonfunctional requirements.
* Explicit non-goals.
* Feature priorities.
* Hardware constraints.
* Security requirements.
* Acceptance criteria.
* Known limitations.

The document must distinguish desired behavior from verified hardware capabilities.

Deliverable B: Technical Feasibility Report

Suggested filename: docs/TECHNICAL_FEASIBILITY.md

Include:

* Research findings.
* Relevant repositories and documentation.
* SmartCast API capability matrix.
* Conjure/runtime findings.
* Application-management findings.
* Startup and lifecycle findings.
* Firmware-modification findings.
* Proof-of-concept results.
* Reproduction instructions.
* Known limitations.
* Unresolved questions.
* Evidence classifications for significant claims.

Include source links and explain how each source supports the conclusion.

Deliverable C: Architecture Decision Record

Suggested filename: docs/ARCHITECTURE.md

Include:

* Recommended architecture.
* Technology stack.
* Component responsibilities.
* Communication flows.
* Authentication model.
* Deployment model.
* Configuration and persistence.
* Security boundaries.
* Error handling.
* Testing strategy.
* Model and firmware compatibility strategy.
* Rejected alternatives and rationale.
* Remaining architectural uncertainties.

Explain why the recommended architecture is the best option given the research results.

Deliverable D: Implementation Roadmap

Suggested filename: docs/IMPLEMENTATION_PLAN.md

Break the implementation into independently testable milestones.

For each milestone, include:

* Objective.
* Prerequisites.
* Dependencies.
* Required components.
* Expected files or modules.
* Implementation instructions.
* Test requirements.
* Acceptance criteria.
* Risks.
* Expected deliverables.

Order the milestones so that the most important technical uncertainties are resolved early and later work depends only on established capabilities.

Deliverable E: Implementation-Agent Handoff

Suggested filename: docs/IMPLEMENTATION_AGENT_PROMPT.md

Write a complete prompt that can be pasted into a separate, less expensive coding LLM.

The prompt must:

1. Explain the product and its goals.
2. Identify the target hardware and firmware.
3. Specify which documents the implementation agent must read first.
4. Identify binding architectural decisions.
5. Identify unverified capabilities that must not be treated as facts.
6. Define the implementation milestones.
7. Specify coding standards and testing expectations.
8. Explain how to handle deviations from the architecture.
9. Require clear documentation of changes and test results.
10. Require the agent to stop and report when a critical assumption fails.
11. Prohibit destructive TV operations without explicit user approval.
12. Minimize unnecessary research repetition.
13. Avoid implementing features that the feasibility report identifies as unsupported.
14. Provide objective acceptance criteria for every milestone.

The implementation agent must not need access to this research conversation to understand the requirements.

Deliverable F: Research Summary

Suggested filename: docs/RESEARCH_SUMMARY.md

Provide a concise executive summary answering:

* What is technically possible?
* What has actually been verified?
* What is the recommended architecture?
* What is the most promising route toward a complete SmartCast replacement?
* What fallback can we reliably build?
* What are the major risks?
* What should be implemented first?
* What requires additional hardware access or user approval?

⸻

9. Implementation Planning Standards

The implementation plan must be specific enough for a coding agent to execute without making major product or architectural decisions.

Avoid vague instructions such as:

* “Implement the TV integration.”
* “Build the launcher.”
* “Add privacy.”
* “Make it reliable.”

Instead, define concrete tasks and tests.

For example, a foundational milestone might require:

1. Implementing a local connection module.
2. Loading credentials from a secure local configuration.
3. Querying the TV’s model and firmware.
4. Returning a structured capability report.
5. Handling connection failures.
6. Writing automated tests using mocked responses.
7. Providing a documented manual test against the real TV.
8. Verifying that no credentials are logged.

The exact tasks should follow from the research and chosen architecture.

For hardware-dependent features, distinguish automated tests from manual tests that require the actual television.

Do not claim that simulated tests establish hardware compatibility.

Where the TV’s capabilities cannot be tested automatically, provide a repeatable manual verification procedure.

⸻

10. Cost and Efficiency

The implementation will be performed by a less expensive LLM.

Design the handoff to minimize unnecessary reasoning and token consumption during implementation.

Specifically:

* Record research conclusions and source links in the repository.
* Document architectural decisions and their rationale.
* Avoid making the implementation agent repeat resolved research.
* Provide explicit file paths and interfaces.
* Define acceptance criteria before implementation.
* Separate experimental work from production work.
* Prefer small, verifiable milestones.
* Identify dependencies between milestones.
* Record known failure modes and workarounds.
* Avoid redundant abstractions and unnecessary dependencies.

Do not optimize for the smallest possible codebase at the expense of reliability.

The goal is to minimize total development cost, including rework caused by incorrect assumptions.

⸻

11. Final Decision Criteria

The research should conclude with a direct recommendation.

Evaluate at least these outcomes:

Outcome A: Full replacement is feasible

Provide the evidence, required mechanisms, architecture, risks, and implementation plan.

Outcome B: A near-native custom experience is feasible

Explain what the TV can run, how it is launched, and which native SmartCast limitations remain.

Outcome C: Only a controller or companion experience is practical

Explain the limitations and provide the most useful fallback.

Outcome D: Deeper modification appears feasible but carries significant risk

Explain the evidence, risks, safer alternatives, and what would need explicit user approval.

Do not force a positive conclusion if the evidence does not support one.

If the full replacement objective is blocked, preserve the parallel research track but recommend a useful fallback that can be delivered independently.

⸻

12. Definition of Done

Your research phase is complete when:

1. The relevant technical landscape has been investigated.
2. The principal architectural alternatives have been evaluated.
3. The critical hardware assumptions have been tested where feasible.
4. The results distinguish verified facts from assumptions.
5. The recommended architecture is justified by evidence.
6. The fallback strategy is explicit.
7. The implementation roadmap contains testable milestones.
8. The implementation-agent prompt is ready to use.
9. All required deliverables are written to the repository, if repository access is available.
10. Remaining uncertainties and required user actions are clearly documented.

If hardware access is unavailable, do not falsely declare the research complete. Produce the research package, identify the missing experiments, and provide exact instructions for performing them.

At the end, present a concise summary of the findings, the recommended direction, the most important unresolved question, and the next action required from the user.

Your objective is to produce an evidence-based, implementation-ready plan for Free My Vizio—not to promise that every desired feature is possible.