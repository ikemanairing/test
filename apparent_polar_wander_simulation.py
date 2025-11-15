"""Simulation illustrating apparent polar wander versus actual continental drift.

This script models a simplified plate motion scenario in which a continental
reference point rotates about a chosen Euler pole while Earth's magnetic pole
remains fixed. The resulting path of the continent across Earth's surface
represents *true* polar wander (actual continental motion), whereas the
trajectory of the geomagnetic pole recorded in rocks—when restored to the
continent's present-day orientation—traces an apparent polar wander (APW)
curve.

Running the script will create a two-panel figure that contrasts both paths
across latitude/longitude space. The output helps explain why plate tectonic
motion causes APW paths even if the magnetic pole is stationary relative to the
spin axis.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Tuple

import matplotlib.pyplot as plt
import numpy as np


@dataclass
class PlateMotionParameters:
    """Parameters describing the simplified plate motion model."""

    angular_velocity_deg_per_myr: float
    rotation_axis_lat: float
    rotation_axis_lon: float
    total_time_myr: float
    time_steps: int


@dataclass
class SimulationResult:
    """Container for storing simulation output."""

    time_myr: np.ndarray
    continent_lat_lon: np.ndarray
    apparent_pole_lat_lon: np.ndarray


def rotation_matrix(axis: np.ndarray, angle_rad: float) -> np.ndarray:
    """Return the rotation matrix for rotating about ``axis`` by ``angle_rad``.

    Uses Rodrigues' rotation formula. ``axis`` must be a unit vector.
    """

    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c = np.cos(angle_rad)
    s = np.sin(angle_rad)
    C = 1 - c
    return np.array(
        [
            [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
            [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
            [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
        ]
    )


def spherical_to_cartesian(lat_deg: float, lon_deg: float) -> np.ndarray:
    """Convert spherical coordinates to a Cartesian unit vector."""

    lat = np.deg2rad(lat_deg)
    lon = np.deg2rad(lon_deg)
    x = np.cos(lat) * np.cos(lon)
    y = np.cos(lat) * np.sin(lon)
    z = np.sin(lat)
    return np.array([x, y, z])


def cartesian_to_spherical(vector: np.ndarray) -> Tuple[float, float]:
    """Convert a Cartesian vector to latitude and longitude in degrees."""

    x, y, z = vector
    lat = np.rad2deg(np.arcsin(np.clip(z, -1.0, 1.0)))
    lon = np.rad2deg(np.arctan2(y, x))
    return float(lat), float(lon)


def simulate_plate_motion(
    params: PlateMotionParameters,
    continent_present_lat: float = 30.0,
    continent_present_lon: float = -20.0,
) -> SimulationResult:
    """Simulate plate motion and compute both true and apparent polar paths."""

    axis = spherical_to_cartesian(params.rotation_axis_lat, params.rotation_axis_lon)
    pole_vector = np.array([0.0, 0.0, 1.0])
    continent_vector = spherical_to_cartesian(continent_present_lat, continent_present_lon)

    time = np.linspace(0.0, params.total_time_myr, params.time_steps)
    # By convention positive time represents the past relative to the present-day plate.
    rotation_angles = np.deg2rad(params.angular_velocity_deg_per_myr * time)

    continent_lat_lon = np.zeros((params.time_steps, 2))
    apparent_lat_lon = np.zeros((params.time_steps, 2))

    for i, angle in enumerate(rotation_angles):
        rot = rotation_matrix(axis, angle)
        past_continent = rot @ continent_vector
        apparent_pole = rot.T @ pole_vector
        continent_lat_lon[i] = cartesian_to_spherical(past_continent)
        apparent_lat_lon[i] = cartesian_to_spherical(apparent_pole)

    return SimulationResult(time, continent_lat_lon, apparent_lat_lon)


def create_visualisation(
    result: SimulationResult,
    params: PlateMotionParameters,
    output_path: str | None = None,
    show_plot: bool = False,
) -> None:
    """Render and optionally save the comparison plot."""

    fig, (ax_continent, ax_apw) = plt.subplots(1, 2, figsize=(12, 5), sharex=True, sharey=True)

    for ax, title in [
        (ax_continent, "Actual continental drift"),
        (ax_apw, "Apparent polar wander path"),
    ]:
        ax.set_xlim(-180, 180)
        ax.set_ylim(-90, 90)
        ax.set_xticks(np.arange(-180, 181, 60))
        ax.set_yticks(np.arange(-90, 91, 30))
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.5)
        ax.set_xlabel("Longitude (°)")
        ax.set_ylabel("Latitude (°)")
        ax.set_title(title)

    time_labels = [0, params.total_time_myr / 2, params.total_time_myr]

    continent_track = result.continent_lat_lon
    ax_continent.plot(continent_track[:, 1], continent_track[:, 0], color="tab:blue")
    ax_continent.scatter(
        continent_track[0, 1],
        continent_track[0, 0],
        color="tab:blue",
        label="Present",
        zorder=5,
    )
    ax_continent.scatter(
        continent_track[-1, 1],
        continent_track[-1, 0],
        color="tab:orange",
        label=f"{params.total_time_myr:.0f} Myr ago",
        zorder=5,
    )
    ax_continent.legend()

    apw_track = result.apparent_pole_lat_lon
    ax_apw.plot(apw_track[:, 1], apw_track[:, 0], color="tab:red")
    ax_apw.scatter(apw_track[0, 1], apw_track[0, 0], color="tab:red", label="Present", zorder=5)
    ax_apw.scatter(
        apw_track[-1, 1],
        apw_track[-1, 0],
        color="tab:green",
        label=f"{params.total_time_myr:.0f} Myr ago",
        zorder=5,
    )
    ax_apw.legend()

    # Annotate a few time markers along the paths.
    for t in time_labels:
        idx = np.argmin(np.abs(result.time_myr - t))
        ax_continent.annotate(
            f"{result.time_myr[idx]:.0f} Myr",
            (continent_track[idx, 1], continent_track[idx, 0]),
            textcoords="offset points",
            xytext=(0, 6),
            ha="center",
            fontsize=8,
        )
        ax_apw.annotate(
            f"{result.time_myr[idx]:.0f} Myr",
            (apw_track[idx, 1], apw_track[idx, 0]),
            textcoords="offset points",
            xytext=(0, 6),
            ha="center",
            fontsize=8,
        )

    fig.suptitle(
        "Simulated relationship between continental drift and apparent polar wander\n"
        f"Euler pole: ({params.rotation_axis_lat:.0f}°, {params.rotation_axis_lon:.0f}°), "
        f"Angular velocity: {params.angular_velocity_deg_per_myr:.2f}°/Myr"
    )
    fig.tight_layout(rect=[0, 0.03, 1, 0.95])

    if output_path:
        fig.savefig(output_path, dpi=200, bbox_inches="tight")
        print(f"Saved simulation figure to {output_path}")

    if show_plot:
        plt.show()
    else:
        plt.close(fig)


def format_summary_table(result: SimulationResult, max_rows: int = 15) -> str:
    """Return a formatted summary table of the simulation results.

    The output is down-sampled to ``max_rows`` entries so that the console
    remains readable even for long simulations.
    """

    header = (
        "Time (Myr)  | Continent Lat  | Continent Lon  | Apparent Pole Lat  | Apparent Pole Lon"
    )
    lines = [header, "-" * len(header)]

    indices = np.linspace(0, len(result.time_myr) - 1, min(max_rows, len(result.time_myr))).astype(int)

    for idx in indices:
        time = result.time_myr[idx]
        c_lat, c_lon = result.continent_lat_lon[idx]
        p_lat, p_lon = result.apparent_pole_lat_lon[idx]
        lines.append(
            f"{time:9.1f} | {c_lat:14.2f} | {c_lon:14.2f} | {p_lat:17.2f} | {p_lon:17.2f}"
        )

    if len(indices) < len(result.time_myr):
        lines.append("... (table truncated) ...")

    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Simulate how apparent polar wander curves emerge from continental drift "
            "under plate tectonics."
        )
    )
    parser.add_argument(
        "--angular-velocity",
        type=float,
        default=0.5,
        help="Plate angular velocity in degrees per million years (default: 0.5).",
    )
    parser.add_argument(
        "--axis-lat",
        type=float,
        default=60.0,
        help="Latitude of the Euler rotation pole in degrees (default: 60).",
    )
    parser.add_argument(
        "--axis-lon",
        type=float,
        default=-90.0,
        help="Longitude of the Euler rotation pole in degrees (default: -90).",
    )
    parser.add_argument(
        "--total-time",
        type=float,
        default=120.0,
        help="Total time span to simulate in million years (default: 120).",
    )
    parser.add_argument(
        "--time-steps",
        type=int,
        default=200,
        help="Number of discrete time steps (default: 200).",
    )
    parser.add_argument(
        "--continent-lat",
        type=float,
        default=30.0,
        help="Present-day latitude of the chosen continental reference point (default: 30).",
    )
    parser.add_argument(
        "--continent-lon",
        type=float,
        default=-20.0,
        help="Present-day longitude of the chosen continental reference point (default: -20).",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="polar_wander_simulation.png",
        help="Path to save the generated figure (default: polar_wander_simulation.png).",
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Display the plot interactively after saving it.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    params = PlateMotionParameters(
        angular_velocity_deg_per_myr=args.angular_velocity,
        rotation_axis_lat=args.axis_lat,
        rotation_axis_lon=args.axis_lon,
        total_time_myr=args.total_time,
        time_steps=args.time_steps,
    )

    result = simulate_plate_motion(
        params,
        continent_present_lat=args.continent_lat,
        continent_present_lon=args.continent_lon,
    )
    print(format_summary_table(result))
    create_visualisation(result, params, output_path=args.output, show_plot=args.show)


if __name__ == "__main__":
    main()
