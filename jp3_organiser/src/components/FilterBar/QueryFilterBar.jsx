/**
 * QueryFilterBar Component
 *
 * FilterBar for the "/" command bar query (?q= in the URL). Shows the query as
 * the command that produced it; clicking it reopens the command bar to edit it.
 * Renders nothing when there is no query.
 *
 * @param {Object} props
 * @param {string} props.tab - The tab this bar sits on (from TABS), so the command includes "| show="
 */

import { useLocation } from 'react-router-dom';
import { useTextFilter } from '../../hooks/useTextFilter';
import { EDIT_COMMAND_EVENT, formatCommand } from '../../utils/commandParser';
import FilterBar from './FilterBar';

export default function QueryFilterBar({ tab }) {
  const { pathname } = useLocation();
  const [textFilter, clearTextFilter] = useTextFilter();

  if (!textFilter) return null;

  const command = formatCommand(pathname, textFilter, tab);
  const edit = () => window.dispatchEvent(new CustomEvent(EDIT_COMMAND_EVENT, { detail: command }));

  return <FilterBar label={`/${command.replace('\n', ' ')}`} onEdit={edit} onClear={clearTextFilter} />;
}
