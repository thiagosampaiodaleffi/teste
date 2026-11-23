/* Camada de dados da Avaliação: Supabase (Database + Storage). Nada aqui toca na tela.
 * Tabelas: lojas, loja_membros, avaliacoes, reparos · Bucket privado: avaliacoes-fotos (loja_id/avaliacao_id/reparo_id.jpg) */
(function () {
  'use strict';
  var BUCKET = 'avaliacoes-fotos';
  var sb = null, state = { lojaId: null, userId: null, papel: null, membros: [] }, photoCache = {};

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function fail(error, fallback) { var e = new Error((error && error.message) || fallback || 'erro'); e.code = error && (error.code || error.message); throw e; }
  function num(v) { return v == null ? null : Number(v); }

  /* ---- conversões banco <-> tela ---- */
  function repFromDb(r) {
    return { id: r.id, fotoPath: r.foto_path || null, regiao: r.regiao, tipo: r.tipo, desc: r.descricao || '', pecas: Number(r.pecas) || 0, mao: Number(r.mao_obra) || 0,
      total: Number(r.total) || 0, direto: !!r.total_direto, obs: r.observacoes || '', ordem: r.ordem || 0 };
  }
  function fromDb(r) {
    return { id: r.id, lojaId: r.loja_id, status: r.status, placa: r.placa || '', marca: r.marca || '', modelo: r.modelo || '', versao: r.versao || '',
      anoFab: r.ano_fabricacao || '', anoMod: r.ano_modelo || '', combustivel: r.combustivel || '', motorizacao: r.motorizacao || '', cor: r.cor || '',
      km: r.km == null ? '' : String(r.km), compra: Number(r.valor_compra) || 0, venda: num(r.preco_venda), origem: r.dados_origem || 'manual',
      criadoPor: r.criado_por, atualizadoPor: r.atualizado_por, criado: Date.parse(r.criado_em), atualizado: Date.parse(r.atualizado_em),
      reparos: (r.reparos || []).map(repFromDb).sort(function (a, b) { return a.ordem - b.ordem; }) };
  }
  var MAP = { status: 'status', placa: 'placa', marca: 'marca', modelo: 'modelo', versao: 'versao', anoFab: 'ano_fabricacao', anoMod: 'ano_modelo',
    combustivel: 'combustivel', motorizacao: 'motorizacao', cor: 'cor', km: 'km', compra: 'valor_compra', venda: 'preco_venda', origem: 'dados_origem' };
  var INTS = { anoFab: 1, anoMod: 1, km: 1 };
  function toDb(patch) {
    var o = {};
    Object.keys(patch).forEach(function (k) {
      if (!MAP[k]) return; var v = patch[k];
      if (INTS[k]) v = v === '' || v == null ? null : parseInt(v, 10);
      else if (k === 'compra') v = Number(v) || 0;
      else if (k === 'venda') v = v == null || v === '' ? null : Number(v);
      else if (k !== 'status' && k !== 'origem') v = v === '' ? null : v;
      o[MAP[k]] = v;
    });
    return o;
  }

  var D = {
    state: state, uuid: uuid,
    init: function (client, user) {
      sb = client; state.userId = user.id;
      return sb.rpc('garantir_loja').then(function (r) {
        if (r.error || !r.data) fail(r.error, 'Não foi possível abrir a sua loja.');
        state.lojaId = r.data; return D.loadMembers();
      });
    },
    loadMembers: function () {
      return sb.rpc('listar_membros', { p_loja: state.lojaId }).then(function (r) {
        if (r.error) fail(r.error);
        state.membros = r.data || [];
        var me = state.membros.filter(function (m) { return m.user_id === state.userId; })[0]; state.papel = me ? me.papel : null;
        return state.membros;
      });
    },
    nome: function (userId) {
      if (!userId) return '—';
      var m = state.membros.filter(function (x) { return x.user_id === userId; })[0];
      return m ? (m.nome || m.email) : 'Ex-funcionário';
    },
    addMember: function (email, papel) { return sb.rpc('adicionar_membro', { p_loja: state.lojaId, p_email: email, p_papel: papel || 'avaliador' }).then(function (r) { if (r.error) fail(r.error); return D.loadMembers(); }); },
    removeMember: function (userId) { return sb.rpc('remover_membro', { p_loja: state.lojaId, p_user: userId }).then(function (r) { if (r.error) fail(r.error); return D.loadMembers(); }); },

    list: function () {
      return sb.from('avaliacoes').select('*, reparos(id,total,pecas,mao_obra,total_direto,regiao,tipo,descricao,observacoes,foto_path,ordem)').eq('loja_id', state.lojaId).order('atualizado_em', { ascending: false })
        .then(function (r) { if (r.error) fail(r.error); return (r.data || []).map(fromDb); });
    },
    get: function (id) {
      return sb.from('avaliacoes').select('*, reparos(*)').eq('id', id).maybeSingle().then(function (r) { if (r.error) fail(r.error); return r.data ? fromDb(r.data) : null; });
    },
    create: function (fields) {
      var row = toDb(fields || {}); row.loja_id = state.lojaId; if (fields && fields.id) row.id = fields.id;
      return sb.from('avaliacoes').insert(row).select('*, reparos(*)').single().then(function (r) { if (r.error) fail(r.error); return fromDb(r.data); });
    },
    update: function (id, patch) {
      return sb.from('avaliacoes').update(toDb(patch)).eq('id', id).select('atualizado_em, atualizado_por').single().then(function (r) {
        if (r.error) fail(r.error); return { atualizado: Date.parse(r.data.atualizado_em), atualizadoPor: r.data.atualizado_por };
      });
    },
    remove: function (av) {
      var paths = av.reparos.filter(function (r) { return r.fotoPath; }).map(function (r) { return r.fotoPath; });
      var p = paths.length ? sb.storage.from(BUCKET).remove(paths) : Promise.resolve({});
      return p.then(function () { return sb.from('avaliacoes').delete().eq('id', av.id); }).then(function (r) { if (r.error) fail(r.error); });
    },

    /* reparo: foto = { blob } para enviar, null para manter, false para remover */
    saveRepair: function (av, rep, foto) {
      var path = rep.fotoPath, step = Promise.resolve();
      var objPath = state.lojaId + '/' + av.id + '/' + rep.id + '.jpg';
      if (foto && foto.blob) step = sb.storage.from(BUCKET).upload(objPath, foto.blob, { contentType: 'image/jpeg', upsert: true }).then(function (r) { if (r.error) fail(r.error, 'Falha ao enviar a foto.'); path = objPath; delete photoCache[objPath]; });
      else if (foto === false && path) { var old = path; step = sb.storage.from(BUCKET).remove([old]).then(function () { path = null; delete photoCache[old]; }); }
      return step.then(function () {
        var row = { id: rep.id, avaliacao_id: av.id, regiao: rep.regiao, tipo: rep.tipo, descricao: rep.desc, pecas: rep.pecas, mao_obra: rep.mao, total: rep.total, total_direto: rep.direto, observacoes: rep.obs, foto_path: path, ordem: rep.ordem };
        return sb.from('reparos').upsert(row).select().single();
      }).then(function (r) { if (r.error) fail(r.error); return repFromDb(r.data); });
    },
    removeRepair: function (rep) {
      var p = rep.fotoPath ? sb.storage.from(BUCKET).remove([rep.fotoPath]) : Promise.resolve({});
      return p.then(function () { return sb.from('reparos').delete().eq('id', rep.id); }).then(function (r) { if (r.error) fail(r.error); });
    },
    photo: function (path) { // Blob da foto (com cache)
      if (!path) return Promise.resolve(null);
      if (!photoCache[path]) photoCache[path] = sb.storage.from(BUCKET).download(path).then(function (r) { if (r.error) { delete photoCache[path]; fail(r.error); } return r.data; });
      return photoCache[path];
    },

    /* ---- migração do navegador (localStorage) para a conta ---- */
    localKey: function () { return 'patio.aval.v1.' + state.userId; },
    localItems: function () {
      try { var s = JSON.parse(localStorage.getItem(D.localKey()) || 'null'); return s && Array.isArray(s.items) ? s.items : []; } catch (e) { return []; }
    },
    migrate: function (onProgress) {
      var items = D.localItems(), map = {}, report = { total: items.length, ok: 0, fotos: 0, avisos: [], erros: [] };
      try { map = JSON.parse(localStorage.getItem(D.localKey() + '.mig') || '{}'); } catch (e) {}
      function dataUrlToBlob(d) { var m = /^data:(.*?);base64,(.*)$/.exec(d), bin = atob(m[2]), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: m[1] }); }
      var chain = Promise.resolve();
      items.forEach(function (it, idx) {
        chain = chain.then(function () {
          if (map[it.id]) { report.ok++; return; }
          var placa = String(it.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), fields = { id: uuid(), marca: it.marca, modelo: it.modelo, anoMod: it.ano, cor: it.cor, km: it.km, compra: it.compra || 0 };
          if (placa.length === 7) fields.placa = placa; else if (placa) report.avisos.push((it.marca || '') + ' ' + (it.modelo || '') + ': placa "' + it.placa + '" incompleta, não migrada (continua na cópia local).');
          var av;
          return D.create(fields).then(function (created) {
            av = created;
            var seq = Promise.resolve();
            (it.reparos || []).forEach(function (r, n) {
              seq = seq.then(function () {
                var rep = { id: uuid(), regiao: r.regiao, tipo: r.tipo, desc: r.desc || '', pecas: r.pecas || 0, mao: r.mao || 0, total: r.total || 0, direto: !!r.direto, obs: r.obs || '', ordem: n, fotoPath: null };
                var foto = r.foto && r.foto.d ? { blob: dataUrlToBlob(r.foto.d) } : null;
                return D.saveRepair(av, rep, foto).then(function () { if (foto) report.fotos++; });
              });
            });
            return seq;
          }).then(function () { return D.get(av.id); }).then(function (check) {
            if (!check || check.reparos.length !== (it.reparos || []).length) throw new Error('conferência falhou');
            map[it.id] = av.id; localStorage.setItem(D.localKey() + '.mig', JSON.stringify(map)); report.ok++;
          }).catch(function (e) { report.erros.push((it.marca || '') + ' ' + (it.modelo || '') + ': ' + (e.message || 'erro')); })
            .then(function () { if (onProgress) onProgress(idx + 1, items.length); });
        });
      });
      return chain.then(function () {
        if (!report.erros.length && report.ok === report.total) { // tudo conferido: guarda cópia de segurança e libera a chave
          try { localStorage.setItem(D.localKey() + '.backup', localStorage.getItem(D.localKey())); localStorage.removeItem(D.localKey()); } catch (e) {}
          report.concluida = true;
        }
        return report;
      });
    },
    hasBackup: function () { try { return !!localStorage.getItem(D.localKey() + '.backup'); } catch (e) { return false; } },
    dropBackup: function () { try { localStorage.removeItem(D.localKey() + '.backup'); localStorage.removeItem(D.localKey() + '.mig'); } catch (e) {} }
  };
  window.PatioAvalData = D;
})();
