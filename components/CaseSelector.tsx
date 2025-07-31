import {
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Popover,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { ArrowDown, FolderIcon, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { CaseItem, caseService } from '@/services/caseService';
import { addRecentCase, getRecentCases } from '@/utils/caseSelector';

async function searchCasesFromAPI(search: string) {
  try {
    const fetchedCase = await caseService.getCases({
      limit: 50,
      page: 1,
      search,
    });

    return fetchedCase;
  } catch (error) {
    console.error(error);
  }
}

type CaseSelectorProps = {
  selectedCase: string;
  cases: CaseItem[];
  disabled?: boolean;
  onCaseSelected: (caseItem: string) => void;
};

export default function CaseSelector({
  selectedCase,
  disabled,
  cases,
  onCaseSelected,
}: CaseSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CaseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentCases, setRecentCases] = useState<string[]>([]);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [anchorEl, setAnchorEl] = useState<HTMLInputElement | null>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    if (event?.currentTarget) setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCaseSelect = async (caseId: string) => {
    onCaseSelected(caseId);
    await addRecentCase(caseId);
    setSearchTerm('');
    handleClose();

    const currentCase = cases.find((caseItem) => caseItem.id === caseId);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({
        selectedCase: currentCase,
      });
    } else {
      localStorage.setItem('selectedCase', JSON.stringify(currentCase));
    }
  };

  useEffect(() => {
    if (!debouncedSearchTerm) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    searchCasesFromAPI(debouncedSearchTerm)
      .then((data) => data && setResults(data))
      .finally(() => setLoading(false));
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (selectedCase) {
      getRecentCases().then(setRecentCases);
    }
  }, [selectedCase]);

  return (
    <div className="relative w-full">
      <TextField
        fullWidth
        label="Case ID"
        value={selectedCase}
        disabled={disabled}
        onClick={handleClick}
        slotProps={{
          input: {
            className: 'max-h-10 py-2 px-1',
            endAdornment: (
              <InputAdornment position="end">
                <ArrowDown />
              </InputAdornment>
            ),
          },
        }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        onClose={handleClose}
        slotProps={{
          paper: {
            className: 'p-2 w-[90%]',
          },
        }}
      >
        <TextField
          autoFocus
          placeholder="Search"
          size="small"
          fullWidth
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search className="text-gray-500" size={16} />
              </InputAdornment>
            ),
            className: 'rounded-xl bg-white',
          }}
        />

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-4">
            <CircularProgress size={20} />
          </div>
        )}

        {/* Search Results */}
        {!loading && debouncedSearchTerm && results.length > 0 && (
          <List disablePadding>
            {results.map((caseItem, i) => (
              <ListItem
                key={i}
                onClick={() => handleCaseSelect(caseItem.id)}
                className="hover:bg-gray-100 rounded-md px-2 py-1"
              >
                <ListItemIcon className="!min-w-[32px] text-gray-600">
                  <FolderIcon size={18} />
                </ListItemIcon>
                <ListItemText
                  primary={caseItem.id}
                  primaryTypographyProps={{
                    className: 'text-sm text-gray-900',
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}

        {/* Recent Cases */}
        {!loading && !debouncedSearchTerm && recentCases.length > 0 && (
          <>
            <p className="text-xs text-gray-400 px-2 mb-1 mt-2">Recent</p>
            <List disablePadding>
              {recentCases.map((caseId, i) => (
                <ListItem
                  key={i}
                  onClick={() => {
                    handleCaseSelect(caseId);
                    handleClose();
                  }}
                  className="hover:bg-gray-100 rounded-md px-2 py-1"
                >
                  <ListItemIcon className="!min-w-[32px] text-gray-600">
                    <FolderIcon size={18} />
                  </ListItemIcon>
                  <ListItemText
                    primary={caseId}
                    primaryTypographyProps={{
                      className: 'text-sm text-gray-900',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Popover>
    </div>
  );
}
