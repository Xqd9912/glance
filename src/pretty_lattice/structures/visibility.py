from __future__ import annotations

from collections.abc import Iterable, Sequence
from itertools import product

from pretty_lattice.structures.schema import ImageReason, VisibilityDependency

IMAGE_REASON_ORDER: tuple[ImageReason, ...] = ("boundary", "bonded")
VISIBILITY_DEPENDENCY_ORDER: tuple[VisibilityDependency, ...] = (
    "boundaryAtoms",
    "oneHopBondedAtoms",
)


def combined_visibility_dependency_groups(
    left_groups: Sequence[frozenset[VisibilityDependency]],
    right_groups: Sequence[frozenset[VisibilityDependency]],
) -> list[frozenset[VisibilityDependency]]:
    return minimal_visibility_dependency_groups(
        frozenset(left_group | right_group)
        for left_group, right_group in product(
            record_visibility_dependency_groups(left_groups),
            record_visibility_dependency_groups(right_groups),
        )
    )


def combined_visibility_dependency_groups_for_records(
    dependency_groups_by_record: Sequence[Sequence[frozenset[VisibilityDependency]]],
) -> list[frozenset[VisibilityDependency]]:
    dependency_groups: list[frozenset[VisibilityDependency]] = [frozenset()]
    for record_groups in dependency_groups_by_record:
        dependency_groups = minimal_visibility_dependency_groups(
            frozenset(left_group | right_group)
            for left_group, right_group in product(
                dependency_groups,
                record_visibility_dependency_groups(record_groups),
            )
        )

    return dependency_groups


def record_visibility_dependency_groups(
    dependency_groups: Sequence[frozenset[VisibilityDependency]],
) -> list[frozenset[VisibilityDependency]]:
    if not dependency_groups:
        return [frozenset()]

    return list(dependency_groups)


def minimal_visibility_dependency_groups(
    dependency_groups: Iterable[frozenset[VisibilityDependency]],
) -> list[frozenset[VisibilityDependency]]:
    minimal_groups: list[frozenset[VisibilityDependency]] = []
    for dependency_group in dependency_groups:
        if any(group.issubset(dependency_group) for group in minimal_groups):
            continue

        minimal_groups = [group for group in minimal_groups if not dependency_group.issubset(group)]
        minimal_groups.append(dependency_group)

    return minimal_groups


def ordered_image_reasons(image_reasons: set[ImageReason]) -> list[ImageReason]:
    return [reason for reason in IMAGE_REASON_ORDER if reason in image_reasons]


def ordered_visibility_dependencies(
    dependencies: set[VisibilityDependency],
) -> list[VisibilityDependency]:
    return [dependency for dependency in VISIBILITY_DEPENDENCY_ORDER if dependency in dependencies]


def ordered_visibility_dependency_groups(
    dependency_groups: Sequence[frozenset[VisibilityDependency]],
) -> list[list[VisibilityDependency]]:
    return [
        ordered_visibility_dependencies(set(dependency_group))
        for dependency_group in dependency_groups
    ]
