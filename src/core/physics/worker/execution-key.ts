import type { PhysicsProject } from "../model/schema";

/**
 * Identity of the solver state. Presentation and lab metadata intentionally do
 * not participate, so editing those fields cannot restart a running solver.
 */
export function physicsExecutionKey(project: PhysicsProject): string {
  const model = project.model.kind === "projectile"
    ? {
        kind: project.model.kind,
        modelVersion: project.model.modelVersion,
        parameters: {
          mass: project.model.parameters.mass,
          gravity: project.model.parameters.gravity,
          drag: project.model.parameters.drag,
          initialX: project.model.parameters.initialX,
          initialY: project.model.parameters.initialY,
          velocityX: project.model.parameters.velocityX,
          velocityY: project.model.parameters.velocityY,
        },
      }
    : {
        kind: project.model.kind,
        modelVersion: project.model.modelVersion,
        parameters: {
          mass: project.model.parameters.mass,
          stiffness: project.model.parameters.stiffness,
          damping: project.model.parameters.damping,
          displacement: project.model.parameters.displacement,
          velocity: project.model.parameters.velocity,
        },
      };
  const simulation = project.simulation;

  return JSON.stringify({
    schemaVersion: project.schemaVersion,
    id: project.id,
    unitPolicy: project.unitPolicy,
    model,
    simulation: {
      fixedTimeStep: simulation.fixedTimeStep,
      duration: simulation.duration,
      maximumSubsteps: simulation.maximumSubsteps,
      sampleEvery: simulation.sampleEvery,
      integrator: simulation.integrator,
      integratorVersion: simulation.integratorVersion,
    },
  });
}
