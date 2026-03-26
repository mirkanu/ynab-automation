import { NextRequest, NextResponse } from 'next/server';

const RAILWAY_GRAPHQL = 'https://backboard.railway.app/graphql/v2';

export async function POST(req: NextRequest) {
  const projectId = process.env.RAILWAY_PROJECT_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
  const serviceId = process.env.RAILWAY_SERVICE_ID;

  if (!projectId || !environmentId || !serviceId) {
    return NextResponse.json(
      { error: 'Not running on Railway — use the copy-paste method below.' },
      { status: 400 }
    );
  }

  const body = await req.json() as { railwayToken: string; variables: Record<string, string> };
  const { railwayToken, variables } = body;

  if (!railwayToken?.trim()) {
    return NextResponse.json({ error: 'Railway API token is required.' }, { status: 400 });
  }

  const mutation = `
    mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }
  `;

  try {
    const res = await fetch(RAILWAY_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${railwayToken}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: { projectId, environmentId, serviceId, variables },
        },
      }),
    });

    const data = await res.json() as { errors?: Array<{ message: string }> };
    if (data.errors?.length) {
      return NextResponse.json({ error: data.errors[0].message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: `Railway API error: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
