import { NextResponse } from 'next/server';
import { listModelConfigs, upsertModelConfig, deleteModelConfig, seedDefaultModels } from '@/lib/db';

export async function GET() {
  try {
    await seedDefaultModels();
    const models = await listModelConfigs();
    return NextResponse.json({ data: models });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model_id, display_name, provider, description, is_enabled, default_temperature, default_max_tokens, sort_order } = body;

    if (!model_id || !display_name || !provider) {
      return NextResponse.json({ error: 'model_id, display_name, and provider are required' }, { status: 400 });
    }

    const config = await upsertModelConfig({
      model_id,
      display_name,
      provider,
      description,
      is_enabled: is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1,
      default_temperature,
      default_max_tokens,
      sort_order,
    });
    return NextResponse.json({ data: config });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await deleteModelConfig(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
