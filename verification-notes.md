# Verification Notes

## Source data

The supplied repository contains three relevant CSV sources. The imported profile totals are **1,380 companies**, **476 solutions**, and **10,000 investors**. The prior Streamlit implementation used vector retrieval plus LLM evaluation; the rebuilt platform retains the matching intent while providing structured database-backed browsing and LLM ranking.

## Browser verification

The startup directory was opened in the live preview. It rendered a Manus-inspired sidebar, type navigation, search and filter inputs, and populated profile cards sourced from the imported HKSTP company dataset. The homepage, natural-language matching workspace, saved-workspace gate, and owner administration screen were also visually captured for review.

The smart-search workspace accepted a representative request for an investor focused on climate technology, AI-enabled energy management, and sustainable urban infrastructure. The subsequent result request is used to validate the structured LLM ranking path.

The matching interface correctly entered its analysing state after submission. The response remained pending during the initial wait, so the server request path requires inspection before final validation.

The live request completed successfully after approximately 30 seconds and rendered eight ranked, dataset-backed startup profiles with numeric compatibility scores and specific LLM explanations. A selected result was then routed into the dedicated profile-specific compatibility workflow for further validation.

The profile-specific route was verified after correcting query-string state handling. It now loads **ACE TECH ENERGY LIMITED** as the selected source profile and exposes the action to generate ranked investor matches.

The dedicated investor-matching request was submitted successfully and displayed the expected analysing state. The long-running LLM ranking request is being allowed to complete before its results are reviewed.

An incomplete LLM JSON response was identified during the first dedicated investor match and handled by constraining ranking output and adding safe parsing with a candidate-ranking fallback. The selected startup workflow was reloaded successfully for regression validation.

The post-fix dedicated ranking request entered the expected analysing state. A final response check follows once the LLM call completes.

The post-fix dedicated ranking completed successfully with six investor profiles, compatibility scores, and data-grounded LLM explanations. The top-ranked investor comparison was selected to validate the detailed strengths, gaps, and talking-points brief.

The side-by-side brief completed successfully for **ACE TECH ENERGY LIMITED × JLL Spark**. It rendered an AI compatibility score, a data-grounded summary, five alignment signals, five questions to resolve, and five suggested talking points. The response clearly distinguished supplied profile facts from missing diligence information.

Desktop and mobile previews were captured for the dashboard, directory, and smart-search experiences. The responsive layout retains clear hierarchy and touch-friendly controls; the directory data was separately verified in the live browser after its initial loading state. Automated verification completed with **11 passing tests** and a clean TypeScript check.
