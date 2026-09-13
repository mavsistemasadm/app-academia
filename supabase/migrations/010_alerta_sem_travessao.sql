-- ============================================================
-- 010 — Texto do alerta de indicador crítico sem travessão
--
-- APLICAR NO SQL EDITOR (DDL não roda pela service role).
--
-- O dono pediu para tirar o travessão de tudo que aparece para professor e
-- aluno. A mensagem do alerta nasce aqui, no gatilho, então só muda de
-- verdade recriando a função. A lógica é a mesma da 004; só o texto mudou.
-- Os alertas que já existiam foram atualizados direto na tabela.
-- ============================================================

create or replace function public.calcular_semaforo_e_alertar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semaforo text;
  v_professor_id uuid;
begin
  case new.tipo
    when 'pressao' then
      if new.valor_principal >= 160 or new.valor_secundario >= 100 then v_semaforo := 'vermelho';
      elsif new.valor_principal >= 130 or new.valor_secundario >= 85 then v_semaforo := 'amarelo';
      else v_semaforo := 'verde';
      end if;
    when 'glicemia' then
      if new.valor_principal >= 200 or new.valor_principal < 70 then v_semaforo := 'vermelho';
      elsif new.valor_principal >= 126 then v_semaforo := 'amarelo';
      else v_semaforo := 'verde';
      end if;
    when 'saturacao' then
      if new.valor_principal < 90 then v_semaforo := 'vermelho';
      elsif new.valor_principal < 95 then v_semaforo := 'amarelo';
      else v_semaforo := 'verde';
      end if;
    when 'fc' then
      if new.valor_principal > 100 or new.valor_principal < 50 then v_semaforo := 'vermelho';
      elsif new.valor_principal > 90 then v_semaforo := 'amarelo';
      else v_semaforo := 'verde';
      end if;
    -- Peso continua verde aqui: o critério real é o IMC, que depende da
    -- altura da avaliação física. Quem resolve é lib/utils/indicadores.ts.
    else v_semaforo := 'verde';
  end case;

  new.status_semaforo := v_semaforo;

  if v_semaforo = 'vermelho' then
    v_professor_id := public.professor_responsavel(new.aluno_id);

    if v_professor_id is not null then
      insert into alertas_professor (professor_id, aluno_id, tipo, mensagem, dados)
      values (
        v_professor_id, new.aluno_id, 'indicador_vermelho',
        'Indicador crítico registrado. Verificar antes do treino.',
        jsonb_build_object(
          'tipo', new.tipo,
          'valor', new.valor_principal,
          'valor2', new.valor_secundario,
          'momento', new.momento
        )
      );
      new.alerta_enviado := true;
    end if;
  end if;

  return new;
end;
$$;
