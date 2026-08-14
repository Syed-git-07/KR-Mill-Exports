const machineModules = [
  {
    key: 'autoconer',
    prefix: 'ac',
    machine: 'autoconer_machines',
    setup: 'autoconer_machine_setup',
    detail: 'autoconer_production_detail',
    header: 'autoconer_production_header',
    stoppage: 'autoconer_stoppage_entry',
    hasMaisitry: false,
    hasCountReferences: true
  },
  {
    key: 'carding',
    prefix: 'card',
    machine: 'carding_machines',
    setup: 'carding_machine_setup',
    detail: 'carding_production_detail',
    header: 'carding_production_header',
    stoppage: 'carding_stoppage_entry',
    hasMaisitry: true
  },
  {
    key: 'drawingBreaker',
    prefix: 'breaker',
    machine: 'drawing_breaker_machines',
    setup: 'breaker_drawing_machine_setup',
    detail: 'breaker_drawing_production_detail',
    header: 'breaker_drawing_production_header',
    stoppage: 'breaker_drawing_stoppage_entry',
    hasMaisitry: true
  },
  {
    key: 'comber',
    prefix: 'comber',
    machine: 'comber_machines',
    setup: 'comber_machine_setup',
    detail: 'comber_production_detail',
    header: 'comber_production_header',
    stoppage: 'comber_stoppage_entry',
    hasMaisitry: true
  },
  {
    key: 'drawingFinisher',
    prefix: 'finisher',
    machine: 'drawing_finisher_machines',
    setup: 'finisher_drawing_machine_setup',
    detail: 'finisher_drawing_production_detail',
    header: 'finisher_drawing_production_header',
    stoppage: 'finisher_drawing_stoppage_entry',
    hasMaisitry: true
  },
  {
    key: 'lapFormer',
    prefix: 'lap',
    machine: 'lap_former_machines',
    setup: 'lap_former_machine_setup',
    detail: 'lap_former_production_detail',
    header: 'lap_former_production_header',
    stoppage: 'lap_former_stoppage_entry',
    hasMaisitry: true
  },
  {
    key: 'simplex',
    prefix: 'simplex',
    machine: 'simplex_machines',
    setup: 'simplex_machine_setup',
    detail: 'simplex_production_detail',
    header: 'simplex_production_header',
    stoppage: 'simplex_stoppage_entry',
    hasMaisitry: true
  },
  {
    key: 'spinning',
    prefix: 'spinning',
    machine: 'spinning_machines',
    setup: 'spinning_machine_setup',
    detail: 'spinning_production_detail',
    header: 'spinning_production_header',
    stoppage: 'spinning_stoppage_entry',
    hasMaisitry: true
  }
]

function relation(constraint, childTable, childColumn, parentTable, parentColumn = 'id') {
  return { constraint, childTable, childColumn, parentTable, parentColumn }
}

const referentialRelations = machineModules.flatMap(moduleConfig => {
  const relations = [
    relation(`fk_${moduleConfig.prefix}_setup_machine`, moduleConfig.setup, 'machine_id', moduleConfig.machine),
    relation(`fk_${moduleConfig.prefix}_detail_header`, moduleConfig.detail, 'header_id', moduleConfig.header),
    relation(`fk_${moduleConfig.prefix}_detail_machine`, moduleConfig.detail, 'machine_id', moduleConfig.machine),
    relation(`fk_${moduleConfig.prefix}_header_supervisor`, moduleConfig.header, 'supervisor_id', 'supervisors'),
    relation(`fk_${moduleConfig.prefix}_stop_detail`, moduleConfig.stoppage, 'production_detail_id', moduleConfig.detail)
  ]

  if (moduleConfig.hasMaisitry) {
    relations.push(relation(`fk_${moduleConfig.prefix}_header_maisitry`, moduleConfig.header, 'maisitry_id', 'supervisors'))
  }
  if (moduleConfig.hasCountReferences) {
    relations.push(
      relation('fk_ac_setup_count', moduleConfig.setup, 'count_id', 'spinning_counts'),
      relation('fk_ac_detail_count', moduleConfig.detail, 'count_id', 'spinning_counts')
    )
  }
  for (let index = 1; index <= 4; index += 1) {
    relations.push(relation(
      `fk_${moduleConfig.prefix}_stop_code${index}`,
      moduleConfig.stoppage,
      `stoppage${index}_id`,
      'stoppage_details'
    ))
  }
  return relations
})

referentialRelations.push(
  relation('fk_autoconer_machine_count', 'autoconer_machines', 'count_id', 'spinning_counts'),
  relation('fk_spinning_machine_count', 'spinning_machines', 'count_id', 'spinning_counts'),
  relation('fk_spinning_setup_count', 'spinning_machine_setup', 'count_id', 'spinning_counts'),
  relation('fk_supervisor_department', 'supervisors', 'department_id', 'departments'),
  relation('fk_stoppage_detail_head', 'stoppage_details', 'stoppage_head_id', 'stoppage_heads'),
  relation('fk_stoppage_detail_department', 'stoppage_details', 'department_id', 'departments'),
  relation('fk_hok_detail_head', 'hok_strength_detail', 'hok_id', 'hok_strength_head', 'hok_id'),
  relation('fk_hok_detail_department', 'hok_strength_detail', 'department_id', 'departments'),
  relation('fk_tpi_count', 'tpi_entries', 'spinning_count_id', 'spinning_counts'),
  relation('fk_twc_count', 'twc_entries', 'spinning_count_id', 'spinning_counts')
)

module.exports = { machineModules, referentialRelations }
